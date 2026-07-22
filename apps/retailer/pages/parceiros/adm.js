import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { hasFinmemoryAdminAllowlist, isFinmemoryAdminEmail } from '../../lib/adminAccess';
import { AdmCompraPanel } from '../../components/adm/AdmCompraPanel';

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

  return {
    props: {
      session: JSON.parse(JSON.stringify(session)),
    },
  };
}

export default function AdmFinMemoryCompraPage() {
  return (
    <>
      <Head>
        <title>ADM FinMemory Compra</title>
        <meta name="robots" content="noindex" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-screen bg-background text-foreground">
        <div className="max-w-6xl mx-auto p-4 sm:p-6">
          <AdmCompraPanel />
        </div>
      </div>
    </>
  );
}
