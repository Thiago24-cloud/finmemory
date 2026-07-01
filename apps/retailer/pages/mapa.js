import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { buildConsumerMapUrl } from '../lib/consumerAppUrl';
import { ParceirosMapFrame } from '../components/merchant/ParceirosMapFrame';

/**
 * Mapa de preços no app Parceiros — iframe do mapa oficial do consumidor (mesmos pins e promoções).
 */
export default function ParceirosMapaPage({ mapUrl }) {
  return (
    <>
      <Head>
        <title>Mapa de preços — FinMemory Parceiros</title>
      </Head>
      <div className="fixed inset-0 z-50 flex flex-col bg-[#e8e4de]">
        <div className="z-10 flex shrink-0 items-center gap-3 border-b border-[#dadce0] bg-white px-3 pb-2 pt-[max(10px,env(safe-area-inset-top))] shadow-[0_1px_3px_rgba(60,64,67,0.12)]">
          <Link
            href="/parceiros/painel"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#dadce0] bg-white px-3 py-2 text-xs font-bold text-[#202124] no-underline hover:bg-[#f8f9fa]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Painel
          </Link>
          <span className="text-sm font-bold text-[#202124]">Mapa de preços</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <ParceirosMapFrame mapUrl={mapUrl} />
        </div>
      </div>
    </>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: '/login?callbackUrl=' + encodeURIComponent('/mapa'),
        permanent: false,
      },
    };
  }

  const { lat, lng, zoom, lista } = ctx.query;
  const mapUrl = buildConsumerMapUrl({
    lat,
    lng,
    zoom,
    from: 'parceiros',
    embed: true,
    lista: typeof lista === 'string' ? lista : undefined,
  });

  return { props: { mapUrl } };
}
