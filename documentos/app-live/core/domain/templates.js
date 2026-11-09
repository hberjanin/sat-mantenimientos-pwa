import { INTERVENTION_TYPES } from './constants.js?v=1.0.4';

/** Devuelve solo los valores de plantilla que realmente corresponden a su tipo. */
export function templateValues(template) {
  if (!template) return {};
  if (template.type === INTERVENTION_TYPES.ASM) {
    return {
      notes: template.notes || '',
      applicationOther: Boolean(template.applicationOther),
      applicationOtherInfo: template.applicationOtherInfo || ''
    };
  }
  return {
    incident: template.incident || '',
    work: template.work || '',
    notes: template.notes || '',
    generateReport: Boolean(template.generateReport),
    reportTitle: template.reportTitle || 'INFORME DE REVISIÓN',
    generalChecks: Array.isArray(template.generalChecks) ? template.generalChecks.map(String) : [],
    otherType: template.otherType || ''
  };
}

export function templateLabel(template) {
  return `${template.type} - ${template.title}`;
}

export function applyTemplateValues(current, template) {
  return { ...current, ...templateValues(template), templateId: template?.id || '' };
}
