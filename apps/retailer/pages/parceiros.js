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
        <title>FinMemory Parceiros — Mapa de preços e estoque para pequenos negócios</title>
        <meta
          name="description"
          content="Compare preços de insumos em mercados próximos, receba alertas e controle o estoque por nota ou foto. Para restaurantes, lanchonetes e lojas de conveniência."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content="FinMemory Parceiros — Compre insumos pelo menor preço" />
        <meta
          property="og:description"
          content="Mapa de preços, lista de compras e controle de estoque para pequenos empreendedores que compram no mercado, atacarejo ou CEASA."
        />
        <link rel="canonical" href="https://finmemory.com.br/parceiros" />
      </Head>
      <PartnersLandingPage socialProviders={socialProviders} />
    </>
  );
}
