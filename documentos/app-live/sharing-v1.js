(function () {
  'use strict';

  const KEY = 'notas-at-data-v1';
  const DEFAULT_FOOTER_LINE_1 = 'División de Protección Radiológica y Física Médica';
  const DEFAULT_FOOTER_LINE_2 = 'Tel: +34 913 52 54 54 · Fax: +34 913 52 46 85 · Web: www.atfisica.com · E-mail: atfisica@atfisica.com';
  const state = { ids: [], files: [], subject: '', pdfCache: new Map() };

  function readData() {
    if (window.appStore?.read) return window.appStore.read();
    try {
      return JSON.parse(localStorage.getItem(KEY) || '{}');
    } catch {
      return { notes: [], visits: [], technicianSignature: '' };
    }
  }

  function technicianFor(note) {
    const data = readData();
    return note?.technician || data.technician1Name || data.technicianName || '';
  }

  function technicianEntries(note, data) {
    const names = String(note?.technician || '').split(/\s*\/\s*|\s*;\s*/).map((value) => value.trim()).filter(Boolean);
    const entries = [
      {
        name: note?.technician1Name || names[0] || data.technician1Name || data.technicianName || '',
        signature: note?.technician1Signature || data.technician1Signature || data.technicianSignature || ''
      },
      {
        name: note?.technician2Name || names[1] || '',
        signature: note?.technician2Signature || ''
      }
    ];
    return entries.filter((entry, index) => index === 0 || entry.name);
  }

  function toast(message) {
    const el = document.querySelector('#toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    window.setTimeout(() => el.classList.remove('show'), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  }

  function clipFieldValue(name, value) {
    // The template, after layout, is the source of truth for the visible limit.
    // A browser-side fitter adds the ellipsis only when the rendered box is full.
    return String(value ?? '');
  }

  function attachTemplateFitter(report) {
    const script = report.createElement('script');
    script.textContent = `(() => {
      'use strict';
      const multilineFields = new Set(['incident', 'work', 'notes', 'incident-explanation']);
      const isMultiline = (element) => multilineFields.has(element.dataset.field) || element.matches('.large-text, .writebox');
      const fits = (element, value, multiline) => {
        element.textContent = value;
        const widthFits = element.scrollWidth <= element.clientWidth + 1;
        const styles = getComputedStyle(element);
        const lineHeight = parseFloat(styles.lineHeight) || 0;
        const boxHeight = element.clientHeight;
        const safetyHeight = multiline ? lineHeight : 0;
        const usableHeight = Math.max(0, boxHeight - safetyHeight);
        const previousHeight = element.style.height;
        const previousMaxHeight = element.style.maxHeight;
        const previousMinHeight = element.style.minHeight;
        if (multiline) {
          element.style.height = 'auto';
          element.style.maxHeight = 'none';
          element.style.minHeight = '0';
        }
        const contentHeight = element.scrollHeight;
        if (multiline) {
          element.style.height = previousHeight;
          element.style.maxHeight = previousMaxHeight;
          element.style.minHeight = previousMinHeight;
        }
        const heightFits = contentHeight <= usableHeight + 1;
        return widthFits && heightFits;
      };
      const fit = (element) => {
        const original = element.textContent || '';
        if (!original) return;
        const multiline = isMultiline(element);
        if (multiline) {
          element.style.display = 'block';
          element.style.overflow = 'hidden';
          element.style.whiteSpace = 'pre-wrap';
        } else {
          element.style.overflow = 'hidden';
          element.style.whiteSpace = 'nowrap';
        }
        if (fits(element, original, multiline)) return;
        let low = 0;
        let high = original.length;
        while (low < high) {
          const middle = Math.ceil((low + high) / 2);
          const candidate = original.slice(0, middle).trimEnd() + '…';
          if (fits(element, candidate, multiline)) low = middle;
          else high = middle - 1;
        }
        let cut = original.slice(0, low).trimEnd();
        const boundary = cut.lastIndexOf(' ');
        if (boundary >= Math.max(0, cut.length - 48)) {
          const wordCut = cut.slice(0, boundary).trimEnd();
          if (fits(element, wordCut + '…', multiline)) cut = wordCut;
        }
        element.textContent = cut ? cut + '…' : '…';
      };
      const run = () => {
        document.querySelectorAll('[data-field]').forEach(fit);
        document.documentElement.dataset.textFitted = '1';
      };
      document.documentElement.dataset.textFitPending = '1';
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(run);
      else run();
    })();`;
    report.body.appendChild(script);
  }

  function formatDate(value) {
    if (!value) return '';
    const parts = String(value).split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : String(value);
  }

  function formatDateTime(note, timeKey) {
    const value = String(note?.[timeKey] || '');
    if (!value) return '';
    const full = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (full) return `${full[3]}/${full[2]}/${full[1]} ${full[4]}:${full[5]}`;
    return [formatDate(note.date), value].filter(Boolean).join(' ');
  }

  function techniciansReady(note) {
    const data = readData();
    return note && !note.deleted && technicianEntries(note, data).every((entry) => Boolean(entry.name && entry.signature));
  }

  function completed(note) {
    return techniciansReady(note) && ['signed', 'absent', 'sent'].includes(note.status);
  }

  function cleanFileName(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 150);
  }

  function noteName(note) {
    const type = note.type === 'ASM / Mantenimiento' ? 'ASM' : 'Intervencion';
    const suffix = type === 'Intervencion' ? '-formato-original' : '';
    return `${cleanFileName(`Nota-${type}-${note.client || 'Cliente'}-${note.model || note.equipment || 'Equipo'}-${note.serial || 'Sin-serie'}-${note.date || 'sin-fecha'}${suffix}`)}.pdf`;
  }

  function hasValue(note, key) {
    return note?.[key] === 'on' || note?.[key] === true || note?.[key] === 1;
  }

  function hasIndexed(note, collectionName, index, suffix) {
    const direct = `${collectionName}${index}${suffix || ''}`;
    if (hasValue(note, direct)) return true;
    const collection = collectionName === 'application' ? note.application : collectionName === 'generalCheck' ? note.generalChecks : note.asmChecks;
    return (collection || []).map(String).includes(String(index) + String(suffix || ''));
  }

  // Los informes se rellenan sobre plantillas HTML y después se convierten a PDF
  // dentro del navegador para conservar el funcionamiento offline.
  async function buildGeneralReportHtml(note) {
    const templatePath = note.type === 'ASM / Mantenimiento'
      ? './notas-intervencion/nota-intervencion-asm-v10.html'
      : './notas-intervencion/nota-intervencion-general-v10.html';
    const templateUrl = new URL(`${templatePath}?html-pdf=1`, location.href);
    const response = await fetch(templateUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar la plantilla HTML (${response.status}).`);
    const html = (await response.text())
      .split('{{ASSET_BASE}}').join(location.origin)
      .split('../../assets/').join(`${location.origin}/assets/`)
      .split('../assets/').join(`${location.origin}/assets/`);
    const report = new DOMParser().parseFromString(html, 'text/html');
    const data = readData();
    const setField = (name, value) => {
      report.querySelectorAll(`[data-field="${name}"]`).forEach((element) => {
        element.textContent = clipFieldValue(name, value);
      });
    };
    const setCheck = (name, active) => {
      report.querySelectorAll(`[data-check="${name}"]`).forEach((element) => {
        if ('checked' in element) element.checked = Boolean(active);
        else element.textContent = active ? 'X' : '';
      });
    };
    const setSignature = (name, dataUrl) => {
      const image = report.querySelector(`[data-signature="${name}"]`);
      if (!image) return;
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) image.src = dataUrl;
      else image.remove();
    };

    setField('client', note.client);
    setField('reportTitle', note.reportTitle || 'Nota de intervención');
    setField('city', note.city);
    setField('province', note.province);
    setField('country', note.country);
    setField('date', formatDate(note.date));
    setField('brand', note.brand === 'Otra / no identificada' ? (note.brandOtherInfo || note.brand) : note.brand);
    setField('model', note.model);
    setField('serial', note.serial);
    setField('incident', note.type === 'ASM / Mantenimiento'
      ? (note.asmIncidentExplanation || (note.asmIncidentYes === 'on' ? 'Sí' : 'No'))
      : note.incident);
    setField('work', note.work);
    setField('workPerformed', note.work);
    setField('notes', note.notes);
    setField('otherType', note.otherType);
    setField('technician', technicianFor(note));
    setField('conclusions', note.conclusions || note.correctiveMeasures || '');
    setField('notice', formatDateTime(note, 'noticeTime'));
    setField('start', formatDateTime(note, 'startTime'));
    setField('end', formatDateTime(note, 'endTime'));
    setField('noticeTime', formatDateTime(note, 'noticeTime'));
    setField('startTime', formatDateTime(note, 'startTime'));
    setField('endTime', formatDateTime(note, 'endTime'));
    setField('totalHours', note.totalHours);
    setField('travel', note.travel);
    const technicians = technicianEntries(note, data);
    const clientName = note.clientAbsent
      ? (note.absenceReason || 'Cliente ausente')
      : (note.clientSigner || data.lastClientSigner || '');
    setField('technician1Signer', technicians[0]?.name || '');
    setField('technician2Signer', technicians[1]?.name || '');
    setField('responsibleSigner', clientName);
    setField('footerLine1', data.footerLine1 || DEFAULT_FOOTER_LINE_1);
    setField('footerLine2', data.footerLine2 || DEFAULT_FOOTER_LINE_2);
    ['instalacion', 'mantenimiento', 'reparacion', 'otros'].forEach((name, index) => setCheck(name, hasIndexed(note, 'generalCheck', index)));
    (note.parts || []).slice(0, 5).forEach((part, index) => {
      const row = index + 1;
      setField(`part${row}Pn`, part.pn);
      setField(`part${row}Ident`, part.ident);
      setField(`part${row}Sn`, part.sn);
    });
    setSignature('technician1', technicians[0]?.signature || '');
    setSignature('technician', technicians[0]?.signature || '');
    setSignature('technician2', technicians[1]?.signature || '');
    setSignature('responsible', note.clientSignature);

    if (note.type === 'ASM / Mantenimiento') {
      ['0', '1', '2', '3', '4'].forEach((index) => setCheck(`application-${index}`, hasIndexed(note, 'application', index)));
      setCheck('asmIncidentYes', hasValue(note, 'asmIncidentYes'));
      setCheck('asmIncidentNo', hasValue(note, 'asmIncidentNo'));
      ['0', '1', '2', '3'].forEach((index) => {
        setCheck(`asmCheck${index}Yes`, hasValue(note, `asmCheck${index}Yes`));
        setCheck(`asmCheck${index}No`, hasValue(note, `asmCheck${index}No`));
        setCheck(`asmCheck${index}NA`, hasValue(note, `asmCheck${index}NA`));
      });
      ['s1PresentYes', 's1PresentNo', 's1WorkingYes', 's1WorkingNo', 's2PresentYes', 's2PresentNo', 's2WorkingYes', 's2WorkingNo']
        .forEach((key) => setCheck(key, hasValue(note, key)));
      const parameterRows = report.querySelectorAll('.compact tbody tr');
      parameterRows.forEach((row, rowIndex) => {
        [...row.cells].slice(1).forEach((cell, columnIndex) => {
          cell.textContent = note.params?.[`${rowIndex}_${columnIndex}`] || '';
        });
      });
    } else {
      ['0', '1', '2', '3'].forEach((index) => setCheck(`generalCheck${index}`, hasIndexed(note, 'generalCheck', index)));
      const partRows = report.querySelectorAll('.parts-table tbody tr');
      (note.parts || []).slice(0, partRows.length).forEach((part, index) => {
        const cells = partRows[index].cells;
        if (cells[1]) cells[1].textContent = part.pn || '';
        if (cells[2]) cells[2].textContent = part.ident || '';
        if (cells[3]) cells[3].textContent = part.sn || '';
      });
    }
    attachTemplateFitter(report);
    const output = `<!doctype html>\n${report.documentElement.outerHTML}`;
    return output;
  }

  async function buildAsmReportHtml(note) {
    const family = String(note.asmFamily || note.family || 'II').trim().toUpperCase();
    const fallbackDetectorLabels = {
      SE: ['1', '2'],
      II: ['1', '2', '3', '4', '5', '6', '7', '8'],
      III: ['1', '2', '3', '4', '5', '6', '7', '8'],
      IV: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2', 'E1', 'E2', 'F1', 'F2', 'G1', 'G2', 'H1', 'H2']
    };
    const fallbackActiveColumnsByVolume = {
      1500: [0],
      3000: [0, 2],
      4500: [0, 1, 2],
      6000: [0, 1, 2, 3],
      9000: [0, 1, 2, 3, 4, 5],
      12000: [0, 1, 2, 3, 4, 5, 6, 7],
      18000: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      21000: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      24000: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    };
    const reportConfig = window.asmReportConfig || {};
    const detectorLabels = reportConfig.detectorLabelsByFamily || fallbackDetectorLabels;
    const activeColumnsByVolume = reportConfig.activeColumnsByVolume || fallbackActiveColumnsByVolume;
    const reportTemplates = {
      SE: { path: './informes/asmse/asmse-report-template.html', label: 'ASM SE', detectorStatus: [1] },
      II: { path: './informes/asm2/asmii-report-template.html', label: 'ASM II', detectorStatus: [1] },
      III: { path: './informes/asm3/asmiii-report-template.html', label: 'ASM III', detectorStatus: [2] },
      IV: { path: './informes/asm4/asmiv-report-template.html', label: 'ASM IV', detectorStatus: [2] }
    };
    const templateBase = reportTemplates[family] || reportTemplates.II;
    const labels = detectorLabels[family] || detectorLabels.II;
    const volume = Number(note.asmVolume || note.volume || note.totalVolume || 0);
    const configuredColumns = activeColumnsByVolume[volume];
    const fallbackCount = family === 'SE' ? 2 : family === 'IV' ? 8 : 8;
    const detectorCount = configuredColumns ? configuredColumns.length : Math.min(fallbackCount, labels.length);
    const template = { ...templateBase, detectors: labels.slice(0, detectorCount), detectorSlots: labels };
    const templateUrl = new URL(`${template.path}?html-pdf=1&template=asm${family.toLowerCase()}`, location.href);
    const response = await fetch(templateUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar la plantilla HTML ${template.label} (${response.status}).`);
    const html = (await response.text())
      .split('../../../assets/').join(`${location.origin}/assets/`)
      .split('href="../asm-report-template.css"').join(`href="${location.origin}/app-live/informes/asm-report-template.css"`);
    const report = new DOMParser().parseFromString(html, 'text/html');
    const data = readData();
    const setField = (name, value) => {
      report.querySelectorAll(`[data-field="${name}"]`).forEach((element) => {
        element.textContent = clipFieldValue(name, value);
      });
    };
    const setConfiguredFooter = () => {
      const line1 = data.footerLine1 || DEFAULT_FOOTER_LINE_1;
      const line2 = data.footerLine2 || DEFAULT_FOOTER_LINE_2;
      report.querySelectorAll('.report-footer').forEach((footer) => {
        const code = footer.querySelector('.code');
        while (footer.firstChild) footer.removeChild(footer.firstChild);
        const first = report.createElement('span');
        first.className = 'footer-line';
        first.textContent = line1;
        const second = report.createElement('span');
        second.className = 'footer-line';
        second.textContent = line2;
        footer.appendChild(first);
        footer.appendChild(second);
        if (code) footer.appendChild(code);
      });
    };
    const setCheck = (name, status) => {
      const element = report.querySelector(`[data-check="${name}"]`);
      if (!element) return;
      element.classList.toggle('is-checked', status === 'checked' || status === true);
      element.classList.toggle('is-na', status === 'na');
    };
    const setSignature = (name, dataUrl) => {
      const image = report.querySelector(`[data-signature="${name}"]`);
      if (!image) return;
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) image.src = dataUrl;
      else image.remove();
    };
    const setPhoto = (name, dataUrl) => {
      const image = report.querySelector(`[data-photo="${name}"]`);
      if (!image) return;
      const placeholder = image.closest('[data-photo-slot]')?.querySelector('.photo-placeholder');
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        image.src = dataUrl;
        if (placeholder) placeholder.hidden = true;
      } else {
        image.removeAttribute('src');
        if (placeholder) placeholder.hidden = false;
      }
    };
    const hideInactiveDetectors = () => {
      const active = new Set(template.detectors);
      report.querySelectorAll('[data-detector-id]').forEach((element) => {
        element.hidden = !active.has(element.dataset.detectorId);
      });
    };
    const asmStatus = (index) => {
      if (index == null) return '';
      if (hasIndexed(note, 'asmCheck', index, 'Yes')) return 'checked';
      if (hasIndexed(note, 'asmCheck', index, 'NA')) return 'na';
      return '';
    };
    const combinedStatus = (indices, applicable = true) => {
      if (!applicable) return 'na';
      const statuses = indices.map(asmStatus);
      if (statuses.includes('checked')) return 'checked';
      if (statuses.length && statuses.every((status) => status === 'na')) return 'na';
      return '';
    };
    const firstAvailable = (...values) => values.find((value) => String(value ?? '').trim()) || '';
    const detectorValue = (kind, detector) => firstAvailable(
      note[`${kind}ByDetector`]?.[detector],
      note[`${kind}ByDetector`]?.[`detector${detector}`],
      note[`${kind}${detector}`],
      note[`${kind}_${detector}`],
      note.params?.[`${kind}-${detector}`],
      note.params?.[`${kind}_${detector}`]
    );
    const photoValue = (group, detector) => {
      const collection = note.photos?.[group] || note.images?.[group] || note.asmPhotos?.[group] || {};
      return firstAvailable(collection[`detector${detector}`], collection[detector], collection[String(detector).toLowerCase()]);
    };
    const firstParameter = (rowIndex) => {
      for (let columnIndex = 0; columnIndex < 16; columnIndex += 1) {
        const value = note.params?.[`${rowIndex}_${columnIndex}`] ?? note[`param_${rowIndex}_${columnIndex}`];
        if (String(value ?? '').trim()) return value;
      }
      return '';
    };
    const sensorSummary = (prefix) => {
      const present = hasValue(note, `${prefix}PresentYes`) ? 'presente' : hasValue(note, `${prefix}PresentNo`) ? 'no presente' : '';
      const working = hasValue(note, `${prefix}WorkingYes`) ? 'funcionando' : hasValue(note, `${prefix}WorkingNo`) ? 'no funcionando' : '';
      return [present, working].filter(Boolean).join(' y ');
    };
    const applicationLabels = ['Camión', 'Tren', 'Cesta', 'Cinta', 'Otro'];
    const applications = applicationLabels.filter((_, index) => hasIndexed(note, 'application', index));
    if (applications.includes('Otro') && note.applicationOtherInfo) applications[applications.indexOf('Otro')] = `Otro: ${note.applicationOtherInfo}`;
    setField('reportNumber', note.reportNumber || '');
    setField('client', note.client);
    setField('equipmentId', note.equipmentId || '');
    setField('model', note.model);
    setField('serial', note.serial);
    setField('controlUnitSerial', firstAvailable(note.controlUnitSerial, note.controlSerial, note.controlUnit?.serial));
    setField('application', applications.join(', '));
    setField('reportDate', formatDate(note.date));
    setField('backgroundInterval', firstAvailable(note.backgroundInterval, firstParameter(1)));
    setField('backgroundAlarmFactor', firstParameter(5));
    setField('highCountAlarmLevel', firstParameter(6));
    setField('lowCountAlarmLevel', firstParameter(7));
    setField('sensorUnlock', [sensorSummary('s1'), sensorSummary('s2')].filter(Boolean).join(' · '));
    setField('detectorUnlock', note.detectorUnlock || '');
    setField('frequency', note.frequency);
    setField('softwareVersion', firstAvailable(note.softwareVersion, note.asmivSoftwareVersion, note.params?.softwareVersion));
    setField('ssdUsage', firstAvailable(note.ssdUsage, note.asmivSsdUsage, note.params?.ssdUsage));
    setField('cfUsage', firstAvailable(note.cfUsage, note.asmivCfUsage, note.params?.cfUsage));
    const detectorSigma = (detector) => {
      const detectorIndex = template.detectorSlots.indexOf(detector);
      const individual = [
        note.sigmaByDetector?.[detector],
        note.sigmaByDetector?.[`detector${detector}`],
        note[`sigma${detector}`],
        note.params?.[`sigma_${detector}`],
        note.params?.[`sigma-${detector}`],
        detectorIndex >= 0 ? note.params?.[`8_${detectorIndex}`] : ''
      ].find((value) => String(value ?? '').trim());
      return individual || note.sigma || '';
    };
    for (const detector of template.detectors) {
      setField(`counts-${detector}`, detectorValue('counts', detector));
      setField(`hv-${detector}`, detectorValue('hv', detector) || (family === 'SE' ? '---' : ''));
      setField(`sigma-${detector}`, detectorSigma(detector));
    }
    for (const amplifier of ['A', 'B', 'C', 'D']) {
      setField(`amplifier-${amplifier}`, firstAvailable(
        note.amplifiers?.[amplifier],
        note.amplifierSerials?.[amplifier],
        note[`amplifier${amplifier}`],
        note[`amplifier${amplifier}Serial`]
      ));
    }
    ['scuNotes', 'detectorNotes', 'parameterNotes', 'installationNotes', 'functionNotes'].forEach((field) => {
      setField(field, note[`${field}Text`] || note.notes || '');
    });
    setField('technician', technicianFor(note));
    setField('reportCity', data.reportCity || '');
    setConfiguredFooter();
    const dateParts = String(note.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    setField('day', dateParts ? dateParts[3] : '');
    setField('month', dateParts ? dateParts[2] : '');
    setField('year', dateParts ? dateParts[1] : '');
    const technicians = technicianEntries(note, data);
    setSignature('technician', technicians[0]?.signature || '');

    // La nota guarda cuatro comprobaciones generales. Cada familia las refleja
    // solo donde existe una equivalencia razonable en su formulario original.
    const scuMaps = {
      SE: [null, null, null, null, 3, 2, null],
      II: [1, 1, 1, 1, 1, 1, 0, 3, 1, 0],
      III: [null, 2, 2, 2, 2, 3, 2, null],
      IV: [null, 1, 1, 1, 1, 3, 1, 1]
    };
    (scuMaps[family] || scuMaps.II).forEach((index, row) => setCheck(`scu-${row}`, combinedStatus(index == null ? [] : [index], index != null)));
    const printerStatus = combinedStatus([3], true);
    ['function-h', 'function-i'].forEach((field) => setCheck(field, printerStatus));
    const detectorStatus = combinedStatus(template.detectorStatus, true);
    template.detectors.forEach((detector) => {
      ['static', 'dynamic', 'background-alarm'].forEach((kind) => setCheck(`${kind}-${detector}`, detectorStatus));
      setCheck(`remote-${detector}`, family === 'II' ? combinedStatus([0], true) : combinedStatus(template.detectorStatus, family !== 'SE'));
      setCheck(`pmt-${detector}`, family === 'IV' ? combinedStatus([2], true) : '');
    });
    ['cabinet-1', 'cabinet-2', 'cabinet-3', 'cabinet-4'].forEach((field) => setCheck(field, family === 'SE' && field.endsWith('3') || family === 'SE' && field.endsWith('4') ? 'na' : detectorStatus));
    ['installation-0', 'installation-1', 'installation-2', 'installation-3', 'function-a', 'function-b', 'function-c', 'function-f'].forEach((field) => setCheck(field, detectorStatus));
    ['level1-concurrent', 'level1-post', 'level2-concurrent', 'level2-post', 'level3-concurrent', 'level3-post', 'algorithm-concurrent', 'algorithm-post', 'algorithm-enhanced'].forEach((field) => setCheck(field, family === 'IV' ? '' : 'na'));
    if (family === 'IV') {
      [['level1-concurrent', 'level1Concurrent'], ['level1-post', 'level1PostProcessing'], ['level2-concurrent', 'level2Concurrent'], ['level2-post', 'level2PostProcessing'], ['level3-concurrent', 'level3Concurrent'], ['level3-post', 'level3PostProcessing']]
        .forEach(([field, key]) => setCheck(field, hasValue(note, key) ? 'checked' : ''));
    }
    setPhoto('parameters', firstAvailable(note.photos?.parameters, note.images?.parameters, note.asmPhotos?.parameters));
    ['scanAlarms', 'backgroundAlarms', 'highAlarms'].forEach((group) => template.detectors.forEach((detector) => setPhoto(`${group}.detector${detector}`, photoValue(group, detector))));
    hideInactiveDetectors();
    attachTemplateFitter(report);
    return `<!doctype html>\n${report.documentElement.outerHTML}`;
  }

  async function renderHtmlToPdf(html, fileName) {
    if (typeof window.html2pdf !== 'function') {
      throw new Error('El generador PDF offline no está disponible. Recarga la aplicación.');
    }

    const portrait = /@page\s*\{[^}]*size:\s*A4\s+portrait/i.test(html);
    const canvasWidth = portrait ? 794 : 1123;
    const canvasHeight = portrait ? 1123 : 794;
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    Object.assign(frame.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: `${canvasWidth}px`,
      height: `${canvasHeight}px`,
      border: '0',
      opacity: '0',
      pointerEvents: 'none'
    });
    document.body.appendChild(frame);

    try {
      frame.srcdoc = html;
      await new Promise((resolve, reject) => {
        frame.addEventListener('load', resolve, { once: true });
        frame.addEventListener('error', () => reject(new Error('No se pudo preparar el informe para PDF.')), { once: true });
      });

      const reportDocument = frame.contentDocument;
      if (!reportDocument?.body) throw new Error('La plantilla del informe no tiene contenido.');
      if (reportDocument.fonts?.ready) await reportDocument.fonts.ready;
      await Promise.all([...reportDocument.images].map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        })));

      const pdfBlob = await window.html2pdf()
        .set({
          margin: 0,
          filename: fileName,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            logging: false,
            width: canvasWidth,
            windowWidth: canvasWidth,
          },
          jsPDF: { unit: 'pt', format: 'a4', orientation: portrait ? 'portrait' : 'landscape', compress: true },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(reportDocument.body)
        .outputPdf('blob');

      return new File([pdfBlob], fileName, { type: 'application/pdf' });
    } finally {
      frame.remove();
    }
  }

  async function createHtmlGeneralPdf(note) {
    return renderHtmlToPdf(await buildGeneralReportHtml(note), noteName(note));
  }

  async function createHtmlAsmPdf(note) {
    return renderHtmlToPdf(await buildAsmReportHtml(note), noteName(note));
  }

  async function buildAdditionalReportHtml(note) {
    const templateUrl = new URL('./propuestas/general-intervention-report.html?html-pdf=1', location.href);
    const response = await fetch(templateUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`No se pudo cargar el informe adicional (${response.status}).`);
    const html = (await response.text()).split('../../assets/').join(`${location.origin}/assets/`);
    const report = new DOMParser().parseFromString(html, 'text/html');
    const data = readData();
    const setField = (name, value) => report.querySelectorAll(`[data-field="${name}"]`).forEach((element) => { element.textContent = clipFieldValue(name, value); });
    const signature = report.querySelector('[data-signature="technician"]');
    const technician = technicianEntries(note, data)[0];
    if (signature && technician?.signature?.startsWith('data:image/')) signature.src = technician.signature;
    else signature?.remove();
    setField('reportTitle', note.reportTitle || 'INFORME DE REVISIÓN');
    setField('client', note.client);
    setField('date', formatDate(note.date));
    setField('model', note.model || note.equipment);
    setField('manufacturer', note.brand === 'Otra / no identificada' ? (note.brandOtherInfo || note.brand) : note.brand);
    setField('serial', note.serial);
    setField('workPerformed', note.work || '');
    setField('notes', note.notes || '');
    setField('technician', technician?.name || technicianFor(note));
    setField('footerLine1', data.footerLine1 || DEFAULT_FOOTER_LINE_1);
    setField('footerLine2', data.footerLine2 || DEFAULT_FOOTER_LINE_2);
    attachTemplateFitter(report);
    return `<!doctype html>\n${report.documentElement.outerHTML}`;
  }

  async function createHtmlAdditionalPdf(note) {
    const name = cleanFileName(`Informe-${note.reportTitle || 'Revision'}-${note.client || 'Cliente'}-${note.model || note.equipment || 'Equipo'}-${note.date || 'sin-fecha'}`) + '.pdf';
    return renderHtmlToPdf(await buildAdditionalReportHtml(note), name);
  }

  async function createPdf(note) {
    // El PDF principal es la nota de intervención. Los informes técnicos ASM
    // siguen disponibles como plantillas independientes y no se mezclan aquí.
    return createHtmlGeneralPdf(note);
  }

  function subjectFor(notes) {
    if (notes.length === 1) {
      const note = notes[0];
      return `${note.client || 'Cliente'} · ${note.model || note.equipment || 'Equipo'} · ${note.serial || 'Sin serie'} · ${formatDate(note.date)}`;
    }
    const visit = readData().visits?.find((item) => item.id === notes[0]?.visitId);
    return `${visit?.client || notes[0]?.client || 'Cliente'} · ${notes.length} notas de intervención · ${formatDate(visit?.date || notes[0]?.date)}`;
  }

  function shareBody(notes) {
      return `Adjunto ${notes.length === 1 ? 'la nota de intervención finalizada' : `las ${notes.length} notas de intervención finalizadas`} de la visita.\n\n${subjectFor(notes)}`;
  }

  function showShareModal(title, content) {
    const modal = document.querySelector('#modal');
    if (!modal) return;
    modal.innerHTML = `<div class="modal-card share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><h2 id="share-title">${escapeHtml(title)}</h2>${content}</div>`;
    modal.hidden = false;
  }

  function updateShareModal(message, ready) {
    const status = document.querySelector('[data-share-status]');
    const share = document.querySelector('[data-native-share]');
    const download = document.querySelector('[data-download-share]');
    if (status) status.innerHTML = message;
    if (share) share.disabled = !ready;
    if (download) download.disabled = !ready;
  }

  function rememberReportGeneration(note, kind) {
    if (!note?.id) return;
    const timestamp = new Date().toISOString();
    const data = readData();
    const target = (data.notes || []).find((item) => item.id === note.id);
    if (!target) return;
    target.reportGeneratedAt = timestamp;
    target.reportGenerationKind = kind;
    target.updated = timestamp;
    if (window.appStore?.write) window.appStore.write(data);
    else localStorage.setItem(KEY, JSON.stringify(data));
  }

  function reportSnapshotId(note, reportType = 'note') {
    const revision = note.reportFinalizedAt || note.updated || note.created || '';
    if (!revision) return '';
    return reportType === 'additional'
      ? `report:${note.id}:${revision}:additional`
      : `report:${note.id}:${revision}`;
  }

  async function archivedReportFile(note, reportType = 'note') {
    if (!completed(note) || !window.appStore?.getReportSnapshot) return null;
    const id = reportSnapshotId(note, reportType);
    if (!id) return null;
    const snapshot = await window.appStore.getReportSnapshot(id);
    if (!snapshot?.pdf) return null;
    return new File([snapshot.pdf], snapshot.fileName || noteName(note), { type: 'application/pdf' });
  }

  async function archiveFinalReport(note, file, kind, reportType = 'note') {
    if (!completed(note) || !window.appStore?.saveReportSnapshot) return;
    const data = readData();
    const settings = {};
    ['reportCity', 'footerLine1', 'footerLine2', 'technician1Name', 'technician1Signature', 'technician2Name', 'technician2Signature']
      .forEach((key) => { settings[key] = data[key] || ''; });
    const revision = note.reportFinalizedAt || note.updated || note.created || String(Date.now());
    const source = JSON.parse(JSON.stringify({ note, settings }));
    try {
      await window.appStore.saveReportSnapshot({
        id: reportSnapshotId(note, reportType) || `report:${note.id}:${revision}${reportType === 'additional' ? ':additional' : ''}`,
        noteId: note.id,
        reportType,
        reportFinalizedAt: note.reportFinalizedAt || '',
        generatedAt: new Date().toISOString(),
        kind,
        fileName: file.name,
        appVersion: document.querySelector('meta[name="app-version"]')?.content || '',
        source,
        pdf: file
      });
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sat-report-archive-error', { detail: { error } }));
    }
  }

  async function createPdfForNote(note, kind = 'preview') {
    const cacheKey = [note.id, note.updated || note.created || '', note.status, note.reportFinalizedAt || ''].join(':');
    const cached = state.pdfCache.get(cacheKey);
    if (cached) return cached;
    const archived = await archivedReportFile(note, 'note');
    if (archived) {
      state.pdfCache.set(cacheKey, archived);
      return archived;
    }
    const file = await createPdf(note);
    state.pdfCache.set(cacheKey, file);
    await archiveFinalReport(note, file, kind);
    // A technician can edit several notes during a long session; keep the
    // in-memory cache bounded so PDFs never become a hidden storage leak.
    while (state.pdfCache.size > 24) state.pdfCache.delete(state.pdfCache.keys().next().value);
    rememberReportGeneration(note, kind);
    return file;
  }

  async function createAdditionalPdfForNote(note, kind = 'preview') {
    const cacheKey = `additional:${note.id}:${note.updated || note.created || ''}:${note.status}:${note.reportTitle || ''}`;
    const cached = state.pdfCache.get(cacheKey);
    if (cached) return cached;
    const archived = await archivedReportFile(note, 'additional');
    if (archived) {
      state.pdfCache.set(cacheKey, archived);
      return archived;
    }
    const file = await createHtmlAdditionalPdf(note);
    state.pdfCache.set(cacheKey, file);
    await archiveFinalReport(note, file, kind, 'additional');
    return file;
  }

  async function createFilesForNote(note, kind) {
    const files = [await createPdfForNote(note, kind)];
    if (note.generateReport) files.push(await createAdditionalPdfForNote(note, kind));
    return files;
  }

  function downloadFile(file) {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    // Keep the click inside the user's activation so mobile browsers allow the download.
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  }

  function showPreviewError(previewWindow, title, message) {
    if (!previewWindow || previewWindow.closed) return;
    previewWindow.document.title = title;
    const paragraph = previewWindow.document.createElement('p');
    paragraph.style.cssText = 'font-family:Arial,sans-serif;padding:24px;color:#8a1c1c';
    paragraph.textContent = message;
    previewWindow.document.body.replaceChildren(paragraph);
  }

  async function previewNote(id) {
    const note = (readData().notes || []).find((item) => item.id === id);
    if (!note || !techniciansReady(note)) {
      toast('Firma primero el informe con el técnico');
      return;
    }
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) {
      toast('El navegador bloqueó la vista previa. Permite ventanas emergentes para esta aplicación.');
      return;
    }
    previewWindow.document.title = 'Generando informe PDF';
    previewWindow.document.body.innerHTML = '<p style="font-family:Arial,sans-serif;padding:24px">Generando el informe PDF…</p>';
    try {
      const file = (await createFilesForNote(note, completed(note) ? 'final-preview' : 'technician-preview'))[0];
      const url = URL.createObjectURL(file);
      previewWindow.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (error) {
      const message = `No se pudo generar la vista previa: ${error.message || 'error desconocido'}`;
      showPreviewError(previewWindow, 'Error al generar el informe PDF', message);
      toast(message);
    }
  }

  async function downloadNotePdf(id) {
    const note = (readData().notes || []).find((item) => item.id === id);
    if (!note || !completed(note)) {
      toast('El PDF descargable estará disponible tras la firma del cliente');
      return;
    }
    toast('Generando PDF final…');
    try {
      const files = await createFilesForNote(note, 'final-download');
      files.forEach(downloadFile);
      toast(`${files.length} PDF${files.length === 1 ? '' : 's'} descargado${files.length === 1 ? '' : 's'}.`);
    } catch (error) {
      toast(`No se pudo descargar el PDF: ${error.message || 'error desconocido'}`);
    }
  }

  async function prepareShare(ids) {
    const data = readData();
    const notes = ids.map((id) => (data.notes || []).find((note) => note.id === id)).filter(Boolean);
    const unfinished = notes.filter((note) => !completed(note));
    if (!notes.length) {
      showShareModal('No se puede enviar', '<p>No se encontraron notas activas.</p><div class="modal-actions"><button class="button" data-share-close>Cerrar</button></div>');
      return;
    }
    if (unfinished.length) {
      showShareModal('Envío no disponible', `<p>Antes de enviar ${ids.length > 1 ? 'la visita completa' : 'esta nota'}, todas las notas deben estar firmadas o tener registrada la ausencia del cliente.</p><p class="hint">Pendientes: ${unfinished.length}</p><div class="modal-actions"><button class="button" data-share-close>Cerrar</button></div>`);
      return;
    }
    const subject = subjectFor(notes);
    state.ids = notes.map((note) => note.id);
    state.files = [];
    state.subject = subject;
    showShareModal('Preparar envío', `<p class="muted">${notes.length === 1 ? 'Se enviará únicamente esta nota.' : `Se enviarán las ${notes.length} notas de esta visita en un único correo.`}</p><div class="share-summary"><b>Asunto</b><span>${escapeHtml(subject)}</span><b>Destinatario</b><span>${escapeHtml(notes[0].clientEmail || data.lastClientEmail || 'Se elegirá en el gestor de correo')}</span><b>Archivos</b><span data-share-file-count>Preparando PDF...</span></div><p data-share-status class="hint">Generando el documento finalizado...</p><div class="modal-actions"><button class="button" data-share-close>Cancelar</button><button class="button" data-download-share disabled>Descargar PDF</button><button class="button primary" data-native-share disabled>Abrir gestor de correo</button></div>`);
    try {
      for (const note of notes) state.files.push(...await createFilesForNote(note, 'final-share'));
      const count = document.querySelector('[data-share-file-count]');
      if (count) count.textContent = `${state.files.length} PDF${state.files.length === 1 ? '' : 's'} · ${formatBytes(state.files.reduce((total, file) => total + file.size, 0))}`;
      updateShareModal('Los PDF están preparados. Revisa el destinatario y pulsa <b>Abrir gestor de correo</b>.', true);
    } catch (error) {
      console.error(error);
      updateShareModal(`<span class="share-error">No se pudieron generar los PDF: ${escapeHtml(error.message || 'error desconocido')}</span>`, false);
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function downloadFiles() {
    state.files.forEach((file) => downloadFile(file));
    toast(`${state.files.length} PDF${state.files.length === 1 ? '' : 's'} descargado${state.files.length === 1 ? '' : 's'}.`);
  }

  function nativeShare() {
    if (!state.files.length) return;
    if (typeof navigator.share !== 'function' || (navigator.canShare && !navigator.canShare({ files: state.files }))) {
      updateShareModal('<span class="share-error">Este navegador no permite compartir varios archivos directamente. Usa <b>Descargar PDF</b> y adjúntalos manualmente en tu correo.</span>', true);
      return;
    }
    const notes = state.ids.map((id) => (readData().notes || []).find((note) => note.id === id)).filter(Boolean);
    navigator.share({ title: state.subject, text: shareBody(notes), files: state.files }).then(() => {
      const data = readData();
      const timestamp = new Date().toISOString();
      state.ids.forEach((id) => { const note = (data.notes || []).find((item) => item.id === id); if (note) note.lastShareAt = timestamp; });
      if (window.appStore?.write) window.appStore.write(data);
      else localStorage.setItem(KEY, JSON.stringify(data));
      document.querySelector('#modal').hidden = true;
      toast('Documentos preparados en el gestor de correo. Confirma allí el envío.');
    }).catch((error) => {
      if (error.name !== 'AbortError') updateShareModal('<span class="share-error">El gestor de correo no pudo abrirse. Descarga los PDF y adjúntalos manualmente.</span>', true);
    });
  }

  function addReportButton(actions, attribute, id, label, primary = false) {
    if (!actions || actions.querySelector(`[data-${attribute}="${id}"]`)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `button small${primary ? ' primary' : ''}`;
    if (attribute === 'preview-note') button.dataset.previewNote = id;
    if (attribute === 'preview-report') button.dataset.previewReport = id;
    if (attribute === 'download-note') button.dataset.downloadNote = id;
    if (attribute === 'share-note') button.dataset.shareNote = id;
    button.textContent = label;
    actions.appendChild(button);
  }

  function addNoteReportButtons(actions, note) {
    if (!actions || !techniciansReady(note)) return;
    addReportButton(actions, 'preview-note', note.id, 'Ver PDF');
    if (note.generateReport) addReportButton(actions, 'preview-report', note.id, 'Ver informe');
    if (completed(note)) {
      addReportButton(actions, 'download-note', note.id, 'Descargar PDF');
      addReportButton(actions, 'share-note', note.id, 'Enviar PDF', true);
    }
  }

  function addVisitShareButton(actions, visitId, notes) {
    if (!actions || actions.querySelector(`[data-share-visit="${visitId}"]`) || !notes.length) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'button small primary';
    button.dataset.shareVisit = visitId;
    button.textContent = 'Enviar todas las notas';
    const ready = notes.every(completed);
    button.disabled = !ready;
    button.title = ready ? 'Enviar todos los PDF finalizados en un único correo' : 'Firma todas las notas antes de enviar la visita';
    actions.appendChild(button);
  }

  function enhance() {
    const data = readData();
    document.querySelectorAll('[data-open-note]').forEach((open) => {
      const note = (data.notes || []).find((item) => item.id === open.dataset.openNote);
      if (note) addNoteReportButtons(open.closest('.actions'), note);
    });
    document.querySelectorAll('[data-share-note]').forEach((button) => {
      const note = (data.notes || []).find((item) => item.id === button.dataset.shareNote);
      if (note && !completed(note)) button.remove();
    });
    const hash = location.hash.slice(1).split('/');
    if (hash[0] === 'historial') {
      document.querySelectorAll('a[href^="#visita/"]').forEach((link) => {
        const visitId = link.getAttribute('href').slice('#visita/'.length);
        const notes = (data.notes || []).filter((note) => note.visitId === visitId && !note.deleted);
        addVisitShareButton(link.closest('.visit-card-head')?.querySelector('.actions'), visitId, notes);
      });
    }
    if (hash[0] === 'visita' && hash[1]) {
      const notes = (data.notes || []).filter((note) => note.visitId === hash[1] && !note.deleted);
      const toolbar = document.querySelector('.toolbar');
      if (notes.length && toolbar && !toolbar.querySelector('[data-share-visit]')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'button primary';
        button.dataset.shareVisit = hash[1];
        toolbar.insertBefore(button, toolbar.querySelector('[data-delete-visit]') || null);
      }
      const button = toolbar?.querySelector('[data-share-visit]');
      if (button) {
        const ready = notes.every(completed);
        button.textContent = 'Enviar todas las notas';
        button.disabled = !ready;
        button.title = ready ? 'Enviar todos los PDF finalizados en un único correo' : 'Firma todas las notas antes de enviar la visita';
      }
    }
    const modalActions = document.querySelector('#modal:not([hidden]) .modal-actions');
    const modalDelete = modalActions?.querySelector('[data-delete-note]');
    if (modalDelete) {
      const note = (data.notes || []).find((item) => item.id === modalDelete.dataset.deleteNote);
      if (note) addNoteReportButtons(modalActions, note);
    }
  }

  document.addEventListener('click', (event) => {
    const previewNoteButton = event.target.closest('[data-preview-note]');
    if (previewNoteButton) { event.preventDefault(); event.stopPropagation(); previewNote(previewNoteButton.dataset.previewNote); return; }
    const previewReportButton = event.target.closest('[data-preview-report]');
    if (previewReportButton) {
      event.preventDefault(); event.stopPropagation();
      const note = (readData().notes || []).find((item) => item.id === previewReportButton.dataset.previewReport);
      if (!note || !techniciansReady(note)) { toast('Firma primero el informe con el técnico'); return; }
      const previewWindow = window.open('', '_blank');
      if (!previewWindow) { toast('El navegador bloqueó la vista previa. Permite ventanas emergentes para esta aplicación.'); return; }
      previewWindow.document.title = 'Generando informe adicional';
      previewWindow.document.body.innerHTML = '<p style="font-family:Arial,sans-serif;padding:24px">Generando el informe adicional…</p>';
      createAdditionalPdfForNote(note, completed(note) ? 'final-report-preview' : 'technician-report-preview').then((file) => {
        previewWindow.location.href = URL.createObjectURL(file);
      }).catch((error) => {
        const message = `No se pudo generar el informe adicional: ${error.message || 'error desconocido'}`;
        showPreviewError(previewWindow, 'Error al generar el informe adicional', message);
        toast(message);
      });
      return;
    }
    const downloadNoteButton = event.target.closest('[data-download-note]');
    if (downloadNoteButton) { event.preventDefault(); event.stopPropagation(); downloadNotePdf(downloadNoteButton.dataset.downloadNote); return; }
    const shareNote = event.target.closest('[data-share-note]');
    if (shareNote) { event.preventDefault(); event.stopPropagation(); prepareShare([shareNote.dataset.shareNote]); return; }
    const shareVisit = event.target.closest('[data-share-visit]');
    if (shareVisit) { event.preventDefault(); event.stopPropagation(); const data = readData(); prepareShare((data.notes || []).filter((note) => note.visitId === shareVisit.dataset.shareVisit && !note.deleted).map((note) => note.id)); return; }
    if (event.target.closest('[data-share-close]')) { event.preventDefault(); document.querySelector('#modal').hidden = true; return; }
    if (event.target.closest('[data-native-share]')) { event.preventDefault(); nativeShare(); return; }
    if (event.target.closest('[data-download-share]')) { event.preventDefault(); downloadFiles(); }
  });

  window.addEventListener('client-signature-completed', async (event) => {
    const noteId = event.detail?.noteId;
    const note = (readData().notes || []).find((item) => item.id === noteId);
    if (!note || !completed(note)) return;
    try {
      await createPdfForNote(note, 'automatic-final-archive');
    } catch (error) {
      window.dispatchEvent(new CustomEvent('sat-report-archive-error', { detail: { error } }));
    }
  });

  window.addEventListener('app-rendered', () => window.setTimeout(enhance, 0));
  window.addEventListener('hashchange', () => window.setTimeout(enhance, 0));
  window.setTimeout(enhance, 0);
})();
