import { describe, expect, it } from 'vitest';
import {
  extractPriceFromText,
  normalizeQueuedProduto,
  splitProdutosByPublishReadiness,
} from '../../lib/promoQueueProcessing.js';

describe('promoQueueProcessing', () => {
  it('extracts BRL prices from text', () => {
    expect(extractPriceFromText('R$ 8,99 cada')).toBe(8.99);
    expect(extractPriceFromText('Oferta 21,90')).toBe(21.9);
    expect(extractPriceFromText('sem preco')).toBeNull();
  });

  it('normalizes product names removing embedded price text', () => {
    const norm = normalizeQueuedProduto({ nome: 'Uva Thompson R$ 12,99', preco: null });
    expect(norm.name).toBe('Uva Thompson');
    expect(norm.price).toBe(12.99);
  });

  it('splits ready vs missing image vs invalid price', () => {
    const split = splitProdutosByPublishReadiness([
      { nome: 'Manga R$ 9,99', imagem_url: 'https://cdn/img.png' },
      { nome: 'Abacaxi', preco: 7.5 },
      { nome: 'Beterraba', preco: null },
    ]);

    expect(split.ready).toHaveLength(1);
    expect(split.pendingImage).toHaveLength(1);
    expect(split.invalid).toHaveLength(1);
  });
});
