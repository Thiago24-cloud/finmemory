import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { buildConsumerMapUrl } from '../lib/consumerAppUrl';

/**
 * Redireciona para o mapa oficial do consumidor (finmemory.com.br/mapa).
 * Mesmo componente, pins e promoções — apps diferentes, banco e mapa únicos.
 */
export default function ParceirosMapaRedirectPage() {
  return null;
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

  const { lat, lng, zoom } = ctx.query;
  return {
    redirect: {
      destination: buildConsumerMapUrl({ lat, lng, zoom, from: 'parceiros' }),
      permanent: false,
    },
  };
}
