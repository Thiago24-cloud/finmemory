import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { MerchantPublicMapEmbed } from '../components/merchant/MerchantPublicMapEmbed';

/**
 * Mapa de preços público dentro do app lojista (iframe → finmemory.com.br/mapa-precos).
 */
export default function ParceirosMapaPage() {
  return (
    <>
      <Head>
        <title>Mapa de preços — FinMemory Parceiros</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="robots" content="noindex" />
      </Head>
      <MerchantPublicMapEmbed />
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
  return { props: {} };
}
