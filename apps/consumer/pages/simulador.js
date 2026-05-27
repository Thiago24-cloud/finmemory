import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import { SimuladorFlow } from '../components/simulador/SimuladorFlow';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/simulador', permanent: false } };
    }
    const allowed = await canAccessForSession(session);
    if (!allowed) {
      return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[simulador getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/simulador', permanent: false } };
  }
}

export default function SimuladorPage() {
  return (
    <>
      <Head>
        <title>Simulador · FinMemory</title>
        <meta
          name="description"
          content="Simule saldo no mês, rede de apoio, entradas incertas e estratégia de crédito."
        />
      </Head>
      <SimuladorFlow />
    </>
  );
}
