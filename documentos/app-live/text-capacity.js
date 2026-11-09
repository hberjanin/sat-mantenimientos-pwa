(function () {
  'use strict';

  // These limits describe the capacity of the printed templates, not the width
  // of the responsive form. PDF rendering performs the final pixel-level fit.
  const RULES = {
    visit: { observations: 600 },
    normal: {
      incident: 1100,
      work: 3600,
      notes: 2700,
      otherType: 55,
      client: 90,
      city: 38,
      country: 28,
      brand: 45,
      model: 62,
      serial: 42,
      technician: 90,
      travel: 72,
      totalHours: 28,
      partCode: 34,
      partDescription: 72
    },
    asm: {
      asmIncidentExplanation: 1500,
      notes: 2500,
      applicationOtherInfo: 55,
      client: 90,
      city: 38,
      country: 28,
      model: 62,
      serial: 42,
      technician: 90,
      travel: 82,
      parameter: 18
    },
    signing: { signer: 70, email: 160, absenceReason: 320 }
  };

  function setLimit(input, limit) {
    if (!input || !Number.isFinite(limit)) return;
    input.maxLength = limit;
    input.dataset.templateMaxlength = String(limit);
    if (input.dataset.capacityBound === '1') return;
    input.dataset.capacityBound = '1';
  }

  function limitForName(name, asm) {
    const rules = asm ? RULES.asm : RULES.normal;
    if (Object.prototype.hasOwnProperty.call(rules, name)) return rules[name];
    if (/^pn\d+$/.test(name) || /^sn\d+$/.test(name)) return rules.partCode;
    if (/^ident\d+$/.test(name)) return rules.partDescription;
    if (/^param_/.test(name)) return rules.parameter;
    if (name === 'otherType') return RULES.normal.otherType;
    if (name === 'applicationOtherInfo') return RULES.asm.applicationOtherInfo;
    return undefined;
  }

  function normalizeSavedValues(values, form) {
    const asm = form?.querySelector('#order-type')?.value === 'ASM / Mantenimiento';
    Object.keys(values).forEach((name) => {
      const limit = limitForName(name, asm);
      const value = values[name];
      if (!limit || typeof value !== 'string' || !value || value.endsWith('…') || value.length < limit) return;
      values[name] = `${value.slice(0, limit - 1).trimEnd()}…`;
    });
    return values;
  }

  function applyCapacity(root = document) {
    root.querySelectorAll('#visit-page-form textarea[name="observations"], #visit-modal-form textarea[name="observations"]').forEach((input) => setLimit(input, RULES.visit.observations));

    const form = root.querySelector('#order-form');
    if (!form) return;
    const asm = form.querySelector('#order-type')?.value === 'ASM / Mantenimiento';
    const rules = asm ? RULES.asm : RULES.normal;

    form.querySelectorAll('textarea[name="incident"], textarea[name="work"], textarea[name="notes"], textarea[name="asmIncidentExplanation"]').forEach((input) => {
      const limit = rules[input.name];
      if (limit) setLimit(input, limit);
    });
    form.querySelectorAll('input[name="client"], input[name="city"], input[name="country"], input[name="brand"], input[name="model"], input[name="serial"], input[name="technician"], input[name="travel"], input[name="totalHours"], input[name="otherType"], input[name="applicationOtherInfo"]').forEach((input) => {
      const limit = rules[input.name] || (input.name === 'otherType' ? RULES.normal.otherType : input.name === 'applicationOtherInfo' ? RULES.asm.applicationOtherInfo : 90);
      setLimit(input, limit);
    });
    form.querySelectorAll('input[name^="pn"], input[name^="sn"]').forEach((input) => setLimit(input, rules.partCode || 34));
    form.querySelectorAll('input[name^="ident"]').forEach((input) => setLimit(input, rules.partDescription || 72));
    form.querySelectorAll('input[name^="param_"]').forEach((input) => setLimit(input, rules.parameter || 18));
  }

  function applySigningCapacity(root = document) {
    setLimit(root.querySelector('#sign-form input[name="signer"]'), RULES.signing.signer);
    setLimit(root.querySelector('#sign-form input[name="email"]'), RULES.signing.email);
    setLimit(root.querySelector('#sign-form textarea[name="absenceReason"]'), RULES.signing.absenceReason);
  }

  window.applyTemplateTextCapacity = applyCapacity;
  window.applySigningTextCapacity = applySigningCapacity;
  window.normalizeTemplateValues = normalizeSavedValues;
  applyCapacity();
  applySigningCapacity();
  window.addEventListener('app-rendered', () => {
    applyCapacity();
    applySigningCapacity();
  });
}());
