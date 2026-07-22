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
        <title>FinMemory Comerciantes — Controle, economia e lucro para o seu negócio</title>
        <meta
          name="description"
          content="App para pequenos empreendedores: compare preços, controle estoque, registre vendas e entenda seu lucro real."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          property="og:title"
          content="FinMemory — Controle seu negócio com mais clareza, economia e lucro"
        />
        <meta
          property="og:description"
          content="Organize compras, estoque e vendas em um só app. Feito para pequenos empreendedores."
        />
        <link
          rel="canonical"
          href="https://finmemorycomerciantes-836908221936.southamerica-east1.run.app/parceiros"
        />
      </Head>
      <PartnersLandingPage socialProviders={socialProviders} />
    </>
  );
}
