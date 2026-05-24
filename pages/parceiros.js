import Head from 'next/head';
import { PartnersLandingPage } from '../components/landing/partners/PartnersLandingPage';
import { getEnabledSocialProviders } from '../lib/auth/getSocialProviders';

/** Evita SSG estático que pode quebrar hidratação com useSession no formulário. */
export async function getServerSideProps() {
  return {
    props: {
      socialProviders: getEnabledSocialProviders(),
    },
  };
}

export default function ParceirosPage({ socialProviders }) {
  return (
    <>
      <Head>
        <title>FinMemory Parceiros — Cadastre sua loja e venda com pick-up inteligente</title>
        <meta
          name="description"
          content="Atraia clientes locais com ofertas por geolocalização, pagamento no app e retirada inteligente. Painel exclusivo para lanchonetes, pizzarias e varejo regional."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="FinMemory Parceiros — Mais clientes, menos fila" />
        <meta
          property="og:description"
          content="Multitenancy para sua loja: estoque, ofertas relâmpago no raio de 2–3 km e split de pagamento automático."
        />
        <link rel="canonical" href="https://finmemory.com.br/parceiros" />
      </Head>
      <PartnersLandingPage socialProviders={socialProviders} />
    </>
  );
}
