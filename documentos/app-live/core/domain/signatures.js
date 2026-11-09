/**
 * Transiciones de firma del cliente.
 *
 * La interfaz solo dibuja y recoge valores; esta funcion decide si la combinacion es
 * valida y produce la nota resultante. Asi el flujo individual y el flujo conjunto no
 * pueden divergir en requisitos o nombres de estado.
 */

export function applyClientOutcome(note, values, signature, timestamp = new Date().toISOString()) {
  const absent = Boolean(values?.absent);
  const reason = String(values?.absenceReason || '').trim();
  if (!absent && !signature) throw new Error('Dibuja la firma o marca Cliente ausente');
  if (absent && !reason) throw new Error('Indica el motivo de la ausencia');
  return {
    ...note,
    status: absent ? 'absent' : 'signed',
    clientAbsent: absent,
    absenceReason: reason,
    clientSigner: String(values?.signer || '').trim(),
    clientEmail: String(values?.email || '').trim(),
    clientSignature: absent ? '' : signature,
    reportFinalizedAt: timestamp,
    signedAt: timestamp,
    updated: timestamp
  };
}
