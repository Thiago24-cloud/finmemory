import { normalizeEanDigits } from './mapInsumoRow';

export function normalizeInsumoNome(nome) {
  return String(nome || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {Array<{ id: string, nome: string, ean?: string|null }>} insumos
 * @param {{ nome: string, ean?: string|null }} item
 */
export function suggestInsumoMatch(insumos, { nome, ean }) {
  if (!Array.isArray(insumos) || insumos.length === 0) return null;

  const eanDigits = normalizeEanDigits(ean);
  if (eanDigits) {
    const byEan = insumos.find((i) => i.ean === eanDigits);
    if (byEan) return { insumo_id: byEan.id, confidence: 'ean', label: byEan.nome };
  }

  const n = normalizeInsumoNome(nome);
  if (!n) return null;

  const exact = insumos.find((i) => normalizeInsumoNome(i.nome) === n);
  if (exact) return { insumo_id: exact.id, confidence: 'exact_name', label: exact.nome };

  if (n.length >= 4) {
    const partial = insumos.find((i) => {
      const ni = normalizeInsumoNome(i.nome);
      return ni.includes(n) || n.includes(ni);
    });
    if (partial) return { insumo_id: partial.id, confidence: 'partial', label: partial.nome };
  }

  return null;
}

/**
 * @param {Array<{ id: string, nome: string, ean?: string|null }>} insumos
 * @param {{ name?: string, nome?: string, price?: number, quantity?: number, ean?: string }} raw
 */
export function mapNotaItemForReview(insumos, raw) {
  const nome = String(raw.name || raw.nome || 'Item').trim().slice(0, 200);
  const quantidade = Math.max(0.001, Number(raw.quantity ?? raw.quantidade ?? 1) || 1);
  const preco = Number(raw.price ?? raw.preco_unitario ?? 0);
  const preco_unitario = Number.isFinite(preco) && preco >= 0 ? Math.round(preco * 100) / 100 : null;
  const ean = normalizeEanDigits(raw.ean);
  const sugestao = suggestInsumoMatch(insumos, { nome, ean });

  return {
    nome,
    ean,
    quantidade: Math.round(quantidade * 1000) / 1000,
    preco_unitario,
    insumo_id: sugestao?.insumo_id || null,
    sugestao_insumo_id: sugestao?.insumo_id || null,
    sugestao_confianca: sugestao?.confidence || null,
    sugestao_label: sugestao?.label || null,
    criar_insumo: !sugestao?.insumo_id,
  };
}
