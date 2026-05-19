import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { MerchantPanel } from '../../components/merchant/MerchantPanel';
import { normalizeAccountType, ACCOUNT_TYPE_VAREJISTA } from '../../lib/userType';

export default function ParceirosPainelPage() {
  return (
    <>
      <Head>
        <title>Painel da loja — FinMemory Parceiros</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      <MerchantPanel />
    </>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: '/login?callbackUrl=' + encodeURIComponent('/parceiros/painel'),
        permanent: false,
      },
    };
  }

  const accountType = normalizeAccountType(session.user.account_type);
  if (accountType !== ACCOUNT_TYPE_VAREJISTA) {
    return {
      redirect: {
        destination: '/escolher-perfil?next=' + encodeURIComponent('/parceiros/painel'),
        permanent: false,
      },
    };
  }

  return { props: {} };
}
