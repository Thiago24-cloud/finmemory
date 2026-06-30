import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import CieloCheckoutPanel from '../components/payments/CieloCheckoutPanel';
import { useCieloCheckout } from '../hooks/useCieloCheckout';

/**
 * Checkout Cielo (Pix) — rota de demonstração / pagamentos avulsos.
 * Query: ?amount=1990&description=FinMemory%20Pro
 */
export default function PagamentoCieloPage() {
  const router = useRouter();
  const { status } = useSession();

  const amountCents = Number(router.query.amount) || 1990;
  const description =
    typeof router.query.description === 'string' && router.query.description.trim()
      ? router.query.description.trim()
      : 'Pagamento FinMemory';

  const checkout = useCieloCheckout({ amountCents, description, paymentMethod: 'pix' });

  useEffect(() => {
    if (!router.isReady || status === 'loading') return;
    if (status === 'unauthenticated') {
      router.replace(`/login?callbackUrl=${encodeURIComponent(router.asPath)}`);
    }
  }, [router, status]);

  if (status !== 'authenticated') {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-sm text-foreground/70">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-lg px-4 py-8">
        <Link
          href="/settings"
          className="mb-6 inline-flex items-center gap-2 text-sm text-foreground/60 hover:text-[#2ECC49]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar
        </Link>

        <CieloCheckoutPanel
          subtitle="Transação processada pela Cielo eCommerce"
          amountCents={amountCents}
          description={description}
          phase={checkout.phase}
          error={checkout.error}
          payment={checkout.payment}
          onPay={() => checkout.startPayment().catch(() => {})}
          isLoading={checkout.isLoading}
          isConfirmed={checkout.isConfirmed}
        />
      </div>
    </div>
  );
}
