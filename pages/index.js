/**
 * Raiz do app: redireciona sempre para o mapa (tela cheia).
 * Posicionamento: app de compras (mapa primeiro) → análise de custos em Gastos.
 */
export async function getServerSideProps() {
  return {
    redirect: { destination: '/mapa', permanent: false },
  };
}

export default function Home() {
  return null;
}
