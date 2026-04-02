import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';

/**
 * Rota legada: scanner NFC-e unificado em /add-receipt?tab=nfce
 */
export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return {
        redirect: {
          destination: '/login?callbackUrl=/add-receipt%3Ftab%3Dnfce',
          permanent: false,
        },
      };
    }
    const allowed = await canAccess(session.user.email);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { redirect: { destination: '/add-receipt?tab=nfce', permanent: false } };
  } catch (err) {
    console.error('[scanner redirect]', err);
    return {
      redirect: {
        destination: '/login?callbackUrl=/add-receipt%3Ftab%3Dnfce',
        permanent: false,
      },
    };
  }
}

export default function ScannerLegacyRedirect() {
  return null;
}
