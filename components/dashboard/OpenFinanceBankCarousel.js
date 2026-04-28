'use client';

import { useCallback, useState } from 'react';
import { Loader2, LayoutGrid } from 'lucide-react';
import { cn } from '../../lib/utils';
import { getBankTheme } from '../../lib/bankThemes';
import { useCalculatorDockOptional } from './CalculatorDockContext';

/**
 * Carrossel de contas Open Finance: tema de marca (logo + cores) e filtro ao toque.
 * @param {{
 *   accounts?: Array<{ id: string; display_name?: string; name?: string; balance?: number; currency_code?: string }>;
 *   loading?: boolean;
 *   selectedAccountId?: string | null;
 *   onSelectAccount?: (accountId: string | null) => void;
 *   className?: string;
 * }} props
 */
export function OpenFinanceBankCarousel({
  accounts = [],
  loading = false,
  selectedAccountId = null,
  onSelectAccount,
  className,
}) {
  const calcDock = useCalculatorDockOptional();
  const [brokenLogos, setBrokenLogos] = useState(() => new Set());

  const markLogoBroken = useCallback((id) => {
    setBrokenLogos((prev) => new Set(prev).add(id));
  }, []);

  const allSelected = selectedAccountId == null || selectedAccountId === '';
  const normalizedAccounts = Array.isArray(accounts) ? accounts : [];
  const visibleAccounts = normalizedAccounts;

  const itemBrandText = visibleAccounts.reduce((acc, account) => {
    const itemId = String(account?.item_id || '').trim();
    if (!itemId) return acc;
    if (acc[itemId]) return acc;
    const candidates = [account?.display_name, account?.name, account?.account_type]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    const tagged = candidates.find(
      (v) =>
        v.toLowerCase().includes('nubank') ||
        v.toLowerCase().includes('c6') ||
        v.toLowerCase().includes('inter') ||
        v.toLowerCase().includes('picpay')
    );
    if (tagged) acc[itemId] = tagged;
    return acc;
  }, {});

  const showAllChip = visibleAccounts.length > 1;

  if (!loading && visibleAccounts.length === 0) {
    return null;
  }

  const canFilter = typeof onSelectAccount === 'function';

  return (
    <section
      className={cn('mb-4', className)}
      aria-label="Contas conectadas (Open Finance)"
    >
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <h2 className="text-sm font-semibold text-[#333] m-0">Contas conectadas</h2>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-[#2ECC49] shrink-0" aria-hidden />}
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory -mx-1 px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading && visibleAccounts.length === 0 ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="snap-start shrink-0 w-[148px] h-[100px] rounded-3xl bg-[#f3f4f6] animate-pulse border border-[#e5e7eb]"
              />
            ))}
          </>
        ) : (
          <>
            {showAllChip && (
              <button
                type="button"
                disabled={!canFilter}
                onClick={() => canFilter && onSelectAccount(null)}
                className={cn(
                  'snap-start shrink-0 w-[min(42vw,152px)] rounded-3xl p-3 text-left min-h-[100px] flex flex-col justify-between transition-transform border-2',
                  'bg-gradient-to-br from-[#f8fafc] to-[#e2e8f0] text-[#0f172a] shadow-sm',
                  allSelected
                    ? 'border-[#2ECC49] ring-2 ring-[#2ECC49]/35 scale-[1.02]'
                    : 'border-transparent hover:border-[#cbd5e1]'
                )}
                aria-pressed={allSelected}
              >
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-white shadow-sm flex items-center justify-center text-[#2ECC49]">
                    <LayoutGrid className="h-5 w-5" strokeWidth={2.2} />
                  </div>
                  <span className="text-[11px] font-bold leading-tight m-0">Todas</span>
                </div>
                <p className="text-[10px] text-[#64748b] m-0 leading-snug">Receitas e despesas de todas as contas</p>
              </button>
            )}
            {visibleAccounts.map((a) => {
              const label = a.display_name || a.name || 'Conta';
              const itemId = String(a?.item_id || '').trim();
              const bankIdentity = itemBrandText[itemId] || label;
              const theme = getBankTheme({
                bankIdentity,
                connectorName: a.connector_name,
                connectorId: a.connector_id,
                connectorImageUrl: a.connector_image_url,
                connectorPrimaryColor: a.connector_primary_color,
              });
              const shortLabel =
                theme.label && label.toLowerCase().includes(theme.label.toLowerCase())
                  ? theme.label
                  : label;
              const balanceNum =
                a.balance != null && Number.isFinite(Number(a.balance)) ? Number(a.balance) : null;
              const bal =
                balanceNum != null
                  ? new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: a.currency_code || 'BRL',
                    }).format(balanceNum)
                  : '—';
              const logoUrl = theme.logoUrl;
              const showLogo = logoUrl && !brokenLogos.has(a.id);
              const selected = selectedAccountId === a.id;

              const pushBalanceToCalc = (e) => {
                if (!calcDock || balanceNum == null || !Number.isFinite(balanceNum)) return;
                calcDock.appendAmount(Math.abs(balanceNum), balanceNum < 0 ? '-' : '+', {
                  allowImplicitJoin: false,
                  flyFrom:
                    typeof e?.clientX === 'number' && typeof e?.clientY === 'number'
                      ? { clientX: e.clientX, clientY: e.clientY }
                      : undefined,
                  flyLabel: bal,
                });
              };

              const activateCard = (e) => {
                if (!canFilter) {
                  pushBalanceToCalc(e);
                  return;
                }
                if (selectedAccountId === a.id) {
                  onSelectAccount(null);
                  return;
                }
                pushBalanceToCalc(e);
                onSelectAccount(a.id);
              };

              return (
                <div
                  key={a.id}
                  role="button"
                  tabIndex={canFilter || calcDock ? 0 : -1}
                  onClick={activateCard}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      activateCard(e);
                    }
                  }}
                  className={cn(
                    'snap-start shrink-0 w-[min(46vw,168px)] rounded-3xl p-3 shadow-sm text-left min-h-[100px] flex flex-col justify-between transition-transform transition-colors duration-300 border-2 active:scale-[0.98]',
                    canFilter || calcDock ? 'cursor-pointer' : 'cursor-default',
                    selected
                      ? 'border-white ring-2 ring-white/90 scale-[1.02]'
                      : 'border-transparent hover:brightness-[1.05]'
                  )}
                  style={{
                    backgroundColor: theme.bgColor,
                    color: theme.textColor,
                    boxShadow: selected
                      ? `0 12px 32px rgba(0,0,0,0.2), 0 0 0 2px ${theme.ringColor}`
                      : `0 10px 28px rgba(0,0,0,0.12), 0 0 0 1px ${theme.ringColor}`,
                  }}
                  aria-pressed={selected}
                  aria-disabled={!canFilter && !calcDock}
                  aria-label={
                    calcDock && balanceNum != null
                      ? `${shortLabel}, saldo ${bal}. Toque para enviar à calculadora${canFilter ? ' e filtrar movimentos' : ''}.`
                      : undefined
                  }
                >
                  <div className="flex items-start gap-2 min-h-[2.25rem]">
                    {showLogo ? (
                      <span className="shrink-0 w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center p-1.5 backdrop-blur-[2px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoUrl}
                          alt=""
                          className="max-w-full max-h-full object-contain"
                          style={{ transform: `scale(${theme.logoScale || 1})` }}
                          loading="lazy"
                          decoding="async"
                          onError={() => markLogoBroken(a.id)}
                        />
                      </span>
                    ) : (
                      <span
                        className="shrink-0 w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-sm font-bold"
                        aria-hidden
                      >
                        {shortLabel.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                    <p className="text-[11px] font-semibold leading-tight line-clamp-2 m-0 flex-1 opacity-95 pt-0.5">
                      {shortLabel}
                    </p>
                  </div>
                  <div className="flex items-end justify-between gap-2 mt-2 min-h-[1.75rem]">
                    <p
                      className="text-base font-bold tabular-nums m-0 leading-tight truncate min-w-0 flex-1"
                      style={{ color: theme.textColor }}
                    >
                      {bal}
                    </p>
                    <span className="text-[9px] font-medium uppercase tracking-wide opacity-90 shrink-0 self-end">
                      Conectado
                    </span>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>
      <p className="text-[10px] text-[#888] mt-1.5 px-0.5 m-0">
        {canFilter
          ? 'Toque no cartão para filtrar por conta/cartão e enviar o saldo à calculadora · Toque de novo no mesmo para ver todos.'
          : 'Conectado · valores do Pluggy'}
        {calcDock
          ? ' Para somar vários saldos: use +, −, × ou ÷ na calculadora e depois toque no próximo cartão.'
          : ''}
      </p>
    </section>
  );
}
