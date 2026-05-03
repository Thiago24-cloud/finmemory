/**
 * Metadados visuais da instituição a partir do payload Pluggy (`fetchItem`).
 * Partilhado entre API Open Finance e sincronização para `transacoes`.
 */

/** @param {unknown} value */
export function cleanPluggyHexColor(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  if (!/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(normalized)) return null;
  return normalized.toUpperCase();
}

/**
 * @param {unknown} item — resposta de `PluggyClient.fetchItem`
 * @returns {{ id: string | null; name: string | null; imageUrl: string | null; primaryColor: string | null }}
 */
export function pickConnectorMeta(item) {
  const connector = item?.connector || item?.institution || null;
  const id = connector?.id != null ? String(connector.id) : null;
  const name =
    connector?.name != null
      ? String(connector.name).trim() || null
      : connector?.institutionName != null
        ? String(connector.institutionName).trim() || null
        : null;
  const imageUrl =
    connector?.imageUrl != null
      ? String(connector.imageUrl).trim() || null
      : connector?.logoUrl != null
        ? String(connector.logoUrl).trim() || null
        : null;
  const primaryColor = cleanPluggyHexColor(
    connector?.primaryColor || connector?.color || connector?.brandColor || null
  );
  return { id, name, imageUrl, primaryColor };
}
