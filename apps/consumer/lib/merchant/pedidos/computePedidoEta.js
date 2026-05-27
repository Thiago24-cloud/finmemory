/**
 * @param {number} tempoPreparoMinutos
 * @param {Date} [from]
 */
export function computeEtaPrevistoEm(tempoPreparoMinutos, from = new Date()) {
  const mins = Math.max(1, Math.min(180, Math.round(Number(tempoPreparoMinutos) || 15)));
  const eta = new Date(from.getTime());
  eta.setMinutes(eta.getMinutes() + mins);
  return eta.toISOString();
}

/**
 * @param {string | null | undefined} etaIso
 */
export function minutesUntilEta(etaIso) {
  if (!etaIso) return null;
  const eta = new Date(etaIso).getTime();
  if (!Number.isFinite(eta)) return null;
  return Math.max(0, Math.round((eta - Date.now()) / 60000));
}
