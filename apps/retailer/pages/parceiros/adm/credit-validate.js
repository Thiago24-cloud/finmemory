import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../api/auth/[...nextauth]';
import { hasFinmemoryAdminAllowlist, isFinmemoryAdminEmail } from '../../../lib/adminAccess';

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return {
      redirect: {
        destination: '/login?callbackUrl=' + encodeURIComponent(ctx.resolvedUrl),
        permanent: false,
      },
    };
  }
  if (!hasFinmemoryAdminAllowlist() || !isFinmemoryAdminEmail(session.user.email)) {
    return { redirect: { destination: '/parceiros/painel?msg=sem-acesso-adm', permanent: false } };
  }
  return {
    redirect: {
      destination: '/parceiros/adm?hub=bridge&view=validar',
      permanent: false,
    },
  };
}

export default function RedirectAdmCreditValidate() {
  return null;
}
