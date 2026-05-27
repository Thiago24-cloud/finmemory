import { describe, expect, it } from 'vitest';
import { detectSubscriptions, normalizeSubscriptionDescription } from './detectSubscriptions';

describe('normalizeSubscriptionDescription', () => {
  it('remove acentos e normaliza', () => {
    expect(normalizeSubscriptionDescription('Netflíx Assinatura')).toContain('NETFLIX');
  });
});

describe('detectSubscriptions', () => {
  it('detecta Netflix por keyword com uma ocorrência', () => {
    const out = detectSubscriptions([
      {
        pluggy_transaction_id: 'tx1',
        description: 'NETFLIX.COM',
        amount: -55.9,
        date: '2026-05-10',
        type: 'DEBIT',
      },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].nome_amigavel).toBe('Netflix');
    expect(out[0].valor).toBe(55.9);
    expect(out[0].dia_cobranca_esperado).toBe(10);
    expect(out[0].sugestao_assinatura).toBe(true);
    expect(out[0].confianca).toBe('alta');
  });

  it('detecta repetição em meses diferentes sem keyword explícita', () => {
    const out = detectSubscriptions([
      {
        pluggy_transaction_id: 'a1',
        description: 'ACME SERVICOS LTDA MENSAL',
        amount: -120,
        date: '2026-03-05',
        type: 'DEBIT',
      },
      {
        pluggy_transaction_id: 'a2',
        description: 'ACME SERVICOS LTDA MENSAL',
        amount: -118.5,
        date: '2026-04-05',
        type: 'DEBIT',
      },
    ]);
    expect(out.length).toBe(1);
    expect(out[0].repeticoes_meses).toBe(2);
    expect(out[0].sugestao_assinatura).toBe(true);
  });

  it('ignora créditos', () => {
    const out = detectSubscriptions([
      {
        description: 'SPOTIFY',
        amount: 50,
        date: '2026-05-01',
        type: 'CREDIT',
      },
    ]);
    expect(out.length).toBe(0);
  });
});
