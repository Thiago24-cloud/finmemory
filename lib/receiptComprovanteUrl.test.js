import { describe, expect, it } from 'vitest';
import {
  isHttpReceiptUrl,
  looksLikeReceiptBinaryPayload,
  receiptUrlDbFields,
} from './receiptComprovanteUrl.js';

describe('receiptComprovanteUrl', () => {
  it('aceita URL https', () => {
    expect(isHttpReceiptUrl('https://finmemory.com.br/receipts/u/1.jpg')).toBe(true);
  });

  it('rejeita data URL', () => {
    expect(isHttpReceiptUrl('data:image/png;base64,abc')).toBe(false);
    expect(looksLikeReceiptBinaryPayload('data:image/png;base64,abc')).toBe(true);
  });

  it('receiptUrlDbFields só grava URL ou null', () => {
    expect(receiptUrlDbFields('https://cdn.example/x.jpg')).toEqual({
      receipt_image_url: 'https://cdn.example/x.jpg',
      url_comprovante: 'https://cdn.example/x.jpg',
    });
    expect(receiptUrlDbFields('data:image/jpeg;base64,x')).toEqual({
      receipt_image_url: null,
      url_comprovante: null,
    });
  });
});
