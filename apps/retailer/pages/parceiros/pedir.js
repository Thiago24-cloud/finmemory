import Head from 'next/head';
import { useRouter } from 'next/router';
import { PedirMesaClient } from '../../components/parceiros/PedirMesaClient';

/**
 * Cardápio público por QR (mesa ou acesso geral).
 * /parceiros/pedir?loja=UUID&mesa=5
 */
export default function ParceirosPedirPage() {
  const router = useRouter();
  const { loja, mesa } = router.query;

  const lojaId = typeof loja === 'string' ? loja : null;
  const mesaNumero =
    mesa != null && mesa !== ''
      ? parseInt(String(mesa), 10)
      : null;
  const mesaParsed = Number.isFinite(mesaNumero) ? mesaNumero : null;

  return (
    <>
      <Head>
        <title>Cardápio — FinMemory</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      {lojaId ? (
        <PedirMesaClient lojaId={lojaId} mesaNumero={mesaParsed} />
      ) : (
        <div className="min-h-screen bg-[#050508] text-white flex items-center justify-center px-4">
          <p className="text-white/50 text-sm text-center m-0">
            Link inválido. Escaneie o QR code da mesa.
          </p>
        </div>
      )}
    </>
  );
}
