import { Loader2, ShieldCheck, QrCode, AlertCircle } from 'lucide-react';

function formatBrl(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Painel de checkout Cielo — identidade premium (dark + verde #2ECC49).
 */
export default function CieloCheckoutPanel({
  title = 'Pagamento seguro',
  subtitle,
  amountCents,
  description,
  phase,
  error,
  payment,
  onPay,
  isLoading,
  isConfirmed,
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2ECC49]/15 text-[#2ECC49]">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#2ECC49]">
            Cielo · FinMemory
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm text-foreground/75">{subtitle}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-foreground/60">Total</p>
          <p className="text-xl font-bold text-[#2ECC49]">{formatBrl(amountCents)}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-foreground/80">{description}</p>

      {error ? (
        <div
          className="mt-4 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
          role="alert"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}

      {isConfirmed ? (
        <div className="mt-6 rounded-xl border border-[#2ECC49]/40 bg-[#2ECC49]/10 px-4 py-3 text-sm text-[#2ECC49]">
          Pagamento confirmado · PaymentId {payment?.paymentId || '—'}
        </div>
      ) : null}

      {phase === 'pix' && payment?.pix?.qrCodeBase64 ? (
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-foreground/80">
            <QrCode className="h-4 w-4 text-[#2ECC49]" aria-hidden />
            Escaneie o Pix para concluir
          </div>
          <img
            src={`data:image/png;base64,${payment.pix.qrCodeBase64}`}
            alt="QR Code Pix"
            className="h-48 w-48 rounded-xl border border-border bg-white p-2"
          />
          <p className="text-center text-xs text-foreground/60">
            Aguardando confirmação… não feche esta tela.
          </p>
        </div>
      ) : null}

      {!isConfirmed ? (
        <button
          type="button"
          onClick={onPay}
          disabled={isLoading || phase === 'pix'}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2ECC49] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#25b340] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Processando…
            </>
          ) : phase === 'pix' ? (
            'Aguardando Pix…'
          ) : (
            'Pagar com Pix'
          )}
        </button>
      ) : null}
    </div>
  );
}
