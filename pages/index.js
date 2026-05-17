import Head from 'next/head';
import InstitutionalLanding from '../components/landing/InstitutionalLanding';

export default function LandingPage() {
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
      <InstitutionalLanding />
    </>
  );
}
