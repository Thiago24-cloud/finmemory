import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';
import { MapQuickAddFlow } from '../components/map/MapQuickAddFlow';
import { useRouter } from 'next/router';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/mapa-quick-add', permanent: false } };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[mapa-quick-add getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/mapa-quick-add', permanent: false } };
  }
}

export default function MapaQuickAddPage() {
  const router = useRouter();
  const wazeUi = router.isReady && router.query.waze === '1';

  return (
    <>
      <Head>
        <title>Curadoria rápida — FinMemory</title>
      </Head>
      <div
        className={`min-h-screen ${wazeUi ? 'bg-[#13161f]' : 'bg-[#f6f7f8]'}`}
      >
        <MapQuickAddFlow wazeUi={wazeUi} />
      </div>
    </>
  );
}
