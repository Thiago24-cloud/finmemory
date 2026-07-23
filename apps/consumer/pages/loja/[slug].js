import Head from 'next/head';
import { useRouter } from 'next/router';
import { PublicStorePage } from '../../components/loja/PublicStorePage';

/**
 * Página pública da loja — /loja/[slug]?src=qr
 * Sem login obrigatório.
 */
export default function LojaPublicaPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === 'string' ? router.query.slug : null;
  const src = typeof router.query.src === 'string' ? router.query.src : null;

  return (
    <>
      <Head>
        <title>{slug ? `Loja — FinMemory` : 'Loja — FinMemory'}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>
      {slug ? (
        <PublicStorePage slug={slug} src={src} />
      ) : (
        <div className="min-h-screen flex items-center justify-center bg-[#f6f7f4]">
          <p className="text-sm text-[#1a2e1a]/60 m-0">Carregando…</p>
        </div>
      )}
    </>
  );
}
