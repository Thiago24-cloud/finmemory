import { describe, expect, it } from 'vitest';
import {
  formatBankAccountDisplayName,
  formatBankAccountDisplayNameMinimal,
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

  it('minimal: Nubank cartão → nubank credito', () => {
    expect(
      formatBankAccountDisplayNameMinimal({
        connectorName: 'Nubank',
        name: 'Nu Pagamentos S.A. - Instituição de Pagamento',
        accountType: 'BANK / CHECKING_ACCOUNT',
      })
    ).toBe('nubank debito');
    expect(
      formatBankAccountDisplayNameMinimal({
        connectorName: 'Nubank',
        name: 'gold',
        accountType: 'CREDIT / CREDIT_CARD',
      })
    ).toBe('nubank credito');
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

  it('saldo com contraste no fundo do cartão (PicPay verde)', () => {
    const picpayBg = '#21C25E';
    expect(getBalanceDisplayColor(ACCOUNT_KIND_DEBITO, 4.2, picpayBg)).toBe('#FFFFFF');
    expect(getBalanceDisplayColor(ACCOUNT_KIND_DEBITO, -1, picpayBg)).toBe('#FEE2E2');
  });

  it('saldo mantém verde semântico em fundo escuro neutro', () => {
    expect(getBalanceDisplayColor(ACCOUNT_KIND_DEBITO, 100, '#334155')).toBe('#22C55E');
  });
});
