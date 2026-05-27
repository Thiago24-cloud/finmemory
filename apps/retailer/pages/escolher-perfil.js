import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';
import { AccountTypeWelcomeScreen } from '../components/onboarding/AccountTypeWelcomeScreen';

export default function EscolherPerfilPage() {
  return <AccountTypeWelcomeScreen />;
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return {
      redirect: { destination: '/login?callbackUrl=/escolher-perfil', permanent: false },
    };
  }
  return { props: {} };
}
