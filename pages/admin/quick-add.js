import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../../lib/adminAccess';
import { canAccess } from '../../lib/access-server';
import QuickAdd from '../../components/admin/QuickAdd';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/admin/quick-add', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccess(session.user.email));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[admin/quick-add getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/admin/quick-add', permanent: false } };
  }
}

export default function AdminQuickAddPage() {
  return (
    <>
      <Head>
        <title>Quick Add — FinMemory</title>
      </Head>
      <QuickAdd />
    </>
  );
}
