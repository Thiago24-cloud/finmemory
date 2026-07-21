import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import { ArrowLeft, Navigation } from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { isParceirosMapView } from '../lib/parceirosMapMode';
import {
  decodeCestaMapParam,
  buildCestaStoreIndex,
  formatCestaBrl,
  pickCestaRouteStopsFromPayload,
} from '../lib/cestaMapEmbed';
import { openGoogleMapsMultiStopRoute } from '../lib/mapDirections';

/**
 * Mapa unificado FinMemory (estrutura Skip dos lojistas) — B2C e embed Parceiros.
 * O mapa antigo (MapaPrecos / pins letra) foi desativado.
 */
const ConsumerMapaSkip = dynamic(
  () =>
    import('../components/map/skip/ConsumerMapaSkip').then((m) => m.ConsumerMapaSkip),
  { ssr: false }
);

function parseCoord(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function retailerAppUrlForMap() {
  const runApp =
    process.env.NEXT_PUBLIC_RETAILER_APP_URL ||
    process.env.FINMEMORY_RETAILER_CLOUD_RUN_URL ||
    'https://finmemory-retailer-836908221936.southamerica-east1.run.app';
  const base = String(runApp).replace(/\/$/, '');
  if (/parceiros\.finmemory\.com\.br/i.test(base)) return base;
  return base;
}

export async function getServerSideProps(ctx) {
  try {
    /** Embed no app Parceiros (iframe) — mapa público, sem login consumidor. */
    if (ctx.query?.from === 'parceiros') {
      return { props: {} };
    }

    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/mapa', permanent: false } };
    }
    const allowed = await canAccessForSession(session);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[mapa getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/mapa', permanent: false } };
  }
}

export default function MapaPage() {
  const router = useRouter();
  const fromParceiros = isParceirosMapView(router);
  const embedInParceirosApp = fromParceiros && router.query?.embed === '1';

  const mapFocusLat = router.isReady ? parseCoord(router.query.lat) : null;
  const mapFocusLng = router.isReady ? parseCoord(router.query.lng) : null;

  const initialQuery = useMemo(() => {
    if (!router.isReady) return '';
    const raw = router.query.lista;
    if (typeof raw === 'string' && raw.trim()) {
      return raw
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 24)
        .join(', ');
    }
    const q = router.query.q || router.query.produto;
    if (typeof q === 'string' && q.trim()) return q.trim();
    return '';
  }, [router.isReady, router.query.lista, router.query.q, router.query.produto]);

  const parceirosCestaFilter = useMemo(() => {
    if (!fromParceiros || !router.isReady) return null;
    const raw = router.query.cesta;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const payload = decodeCestaMapParam(raw);
    if (!payload) return null;
    const minRaw = router.query.cesta_min ?? payload.min ?? 1;
    const minCoverage = Number(minRaw);
    const storeIndex = buildCestaStoreIndex(payload);
    if (storeIndex.size === 0) return null;
    const routeStops = pickCestaRouteStopsFromPayload(payload, { maxStops: 5 });
    const wantRota =
      router.query.rota === '1' || payload.r === 1 || payload.r === true;
    return {
      enabled: true,
      minCoverage: Number.isFinite(minCoverage) ? minCoverage : 1,
      storeIndex,
      storeCount: storeIndex.size,
      bestTotal: Math.min(
        ...[...storeIndex.values()]
          .map((m) => Number(m.total) || Infinity)
          .filter(Number.isFinite)
      ),
      routeStops,
      wantRota: Boolean(wantRota && routeStops.length),
    };
  }, [
    fromParceiros,
    router.isReady,
    router.query.cesta,
    router.query.cesta_min,
    router.query.rota,
  ]);

  const parceirosCestaMapMode = Boolean(parceirosCestaFilter?.enabled);
  const parceirosPainelUrl = `${retailerAppUrlForMap()}/parceiros/painel`;

  return (
    <>
      <Head>
        <title>FinMemory – Onde está mais barato? | App de compras e análise de custos</title>
      </Head>

      {router.isReady ? (
        <ConsumerMapaSkip
          initialQuery={initialQuery}
          parceirosMode={fromParceiros}
          centerLat={mapFocusLat}
          centerLng={mapFocusLng}
          onBack={
            fromParceiros
              ? undefined
              : () => {
                  router.push('/');
                }
          }
        />
      ) : (
        <div className="fixed inset-0 z-50 bg-[#0d1b2e]" aria-busy="true" />
      )}

      {fromParceiros && embedInParceirosApp && parceirosCestaMapMode ? (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[70] flex flex-col items-center gap-2 px-3 pt-[max(8px,env(safe-area-inset-top))]">
          <div className="pointer-events-auto max-w-md rounded-full border border-[#39FF14]/35 bg-white/95 px-4 py-2 text-center shadow-sm backdrop-blur-sm">
            <p className="m-0 text-[11px] font-bold text-[#166534]">
              Sua cesta · {parceirosCestaFilter.storeCount} mercado(s)
              {Number.isFinite(parceirosCestaFilter.bestTotal)
                ? ` · a partir de ${formatCestaBrl(parceirosCestaFilter.bestTotal)}`
                : ''}
            </p>
          </div>
          {parceirosCestaFilter.wantRota && parceirosCestaFilter.routeStops?.length ? (
            <button
              type="button"
              onClick={() => {
                const origin =
                  mapFocusLat != null && mapFocusLng != null
                    ? { lat: mapFocusLat, lng: mapFocusLng }
                    : null;
                openGoogleMapsMultiStopRoute(origin, parceirosCestaFilter.routeStops);
              }}
              className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[#166534]/30 bg-[#166534] px-4 py-2 text-[11px] font-bold text-white shadow-sm hover:bg-[#14532d]"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden />
              Iniciar rota ({parceirosCestaFilter.routeStops.length} parada
              {parceirosCestaFilter.routeStops.length > 1 ? 's' : ''})
            </button>
          ) : null}
        </div>
      ) : null}

      {fromParceiros && !embedInParceirosApp ? (
        <div className="pointer-events-none fixed top-0 left-0 right-0 z-[70] flex justify-start px-3 pt-[max(10px,env(safe-area-inset-top))]">
          <a
            href={parceirosPainelUrl}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-2 text-xs font-bold text-[#202124] shadow-[0_1px_3px_rgba(60,64,67,0.2)] hover:bg-[#f8f9fa] no-underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Painel Parceiros
          </a>
        </div>
      ) : null}
    </>
  );
}
