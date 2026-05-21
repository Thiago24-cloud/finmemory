import { describe, expect, it } from 'vitest';
import {
  formatBankAccountDisplayName,
  getBalanceDisplayColor,
  inferAccountKind,
  ACCOUNT_KIND_CREDITO,
  ACCOUNT_KIND_DEBITO,
} from './bankAccountDisplay';

describe('bankAccountDisplay', () => {
  it('Nubank cartão → Nubank Crédito', () => {
    expect(
      formatBankAccountDisplayName({
        connectorName: 'Nubank',
        name: 'Gold',
        accountType: 'CREDIT / CREDIT_CARD',
      })
    ).toBe('Nubank Crédito');
    expect(
      inferAccountKind('CREDIT / CREDIT_CARD', 'Ultraviolet')
    ).toBe(ACCOUNT_KIND_CREDITO);
  });

  it('PicPay conta → PicPay Débito', () => {
    expect(
      formatBankAccountDisplayName({
        connectorName: 'PicPay',
        name: 'Conta PicPay',
        accountType: 'BANK / CHECKING_ACCOUNT',
      })
    ).toBe('PicPay Débito');
    expect(inferAccountKind('BANK / CHECKING_ACCOUNT', 'Conta')).toBe(ACCOUNT_KIND_DEBITO);
  });

  it('cores de saldo', () => {
    expect(getBalanceDisplayColor(ACCOUNT_KIND_CREDITO, -500)).toBe('#EF4444');
    expect(getBalanceDisplayColor(ACCOUNT_KIND_DEBITO, 1200)).toBe('#22C55E');
    expect(getBalanceDisplayColor(ACCOUNT_KIND_DEBITO, -10)).toBe('#EF4444');
  });
});
