import Head from 'next/head';
import { getServerSession } from 'next-auth/next';
import InstitutionalLanding from '../components/landing/InstitutionalLanding';
import { AuthenticatedHomeRedirect } from '../components/landing/AuthenticatedHomeRedirect';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';

const ACCESS_NOTICES = {
  'nao-cadastrado':
    'Não foi possível abrir o app com esta sessão. Saia e entre novamente ou contacte o suporte em finmemory.oficial@gmail.com.',
};

export default function LandingPage({ accessNotice }) {
  return (
    <>
      <Head>
        <title>FinMemory — O GPS do Consumo Inteligente e da Gestão Comercial</title>
        <meta
          name="description"
          content="Ecossistema que une automação financeira, mapa de preços em tempo real e gestão do pequeno varejo brasileiro. Baixe o app na Google Play."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="FinMemory — Consumo inteligente e gestão comercial" />
        <meta
          property="og:description"
          content="Automação financeira, mapa de preços e inteligência para consumidor e varejista."
        />
      </Head>
      <AuthenticatedHomeRedirect />
      <InstitutionalLanding accessNotice={accessNotice} />
    </>
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  const msg = typeof ctx.query?.msg === 'string' ? ctx.query.msg : null;

  if (session?.user?.email && msg !== 'nao-cadastrado') {
    const allowed = await canAccessForSession(session);
    if (allowed) {
      return {
        redirect: { destination: '/dashboard', permanent: false },
      };
    }
  }

  const accessNotice =
    msg && ACCESS_NOTICES[msg] ? ACCESS_NOTICES[msg] : null;

  return { props: { accessNotice } };
}
