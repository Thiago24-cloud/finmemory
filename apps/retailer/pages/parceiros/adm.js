import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { hasFinmemoryAdminAllowlist, isFinmemoryAdminEmail } from '../../lib/adminAccess';
import { AdmHub } from '../../components/adm/AdmHub';

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: '/login?callbackUrl=' + encodeURIComponent('/parceiros/adm'),
        permanent: false,
      },
    };
  }

  if (!hasFinmemoryAdminAllowlist() || !isFinmemoryAdminEmail(session.user.email)) {
    return {
      redirect: {
        destination: '/parceiros/painel?msg=sem-acesso-adm',
        permanent: false,
      },
    };
  }

  const hub = typeof ctx.query.hub === 'string' ? ctx.query.hub : 'bridge';
  const view = typeof ctx.query.view === 'string' ? ctx.query.view : 'carteira';

  return {
    props: {
      session: JSON.parse(JSON.stringify(session)),
      initialHub: hub,
      initialView: view,
    },
  };
}

export default function AdmFinMemoryPage({ initialHub, initialView }) {
  return (
    <>
      <Head>
        <title>FinMemory — ADM</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-[100dvh] bg-[#fafbfa] text-foreground">
        <AdmHub initialHub={initialHub} initialView={initialView} />
      </div>
    </>
  );
}
