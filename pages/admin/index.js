import Head from 'next/head';
import Link from 'next/link';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { canAccessAdminRoutes } from '../../lib/adminAccess';
import { canAccess } from '../../lib/access-server';

export async function getServerSideProps(ctx) {
  try {
    const session = await getServerSession(ctx.req, ctx.res, authOptions);
    if (!session?.user?.email) {
      return { redirect: { destination: '/login?callbackUrl=/admin', permanent: false } };
    }
    const allowed = await canAccessAdminRoutes(session.user.email, () => canAccess(session.user.email));
    if (!allowed) {
      return { redirect: { destination: '/?msg=sem-acesso-admin', permanent: false } };
    }
    return { props: {} };
  } catch (err) {
    console.error('[admin/index getServerSideProps]', err);
    return { redirect: { destination: '/login?callbackUrl=/admin', permanent: false } };
  }
}

export default function AdminHomePage() {
  const cards = [
    {
      href: '/admin/map-thumbnail-rules',
      title: 'Miniaturas — treino e regras',
      desc:
        'Keywords + URL HTTPS opcional por regra (prioridade no mapa), depois repositório, depois APIs. Mesma página onde defines confiança nas fotos.',
      ready: true,
      badge: 'Atualizado',
    },
    {
      href: '/admin/product-image-curator',
      title: 'Curador de imagens (Google)',
      desc:
        'Produtos sem foto: busca até 3 imagens (fundo branco png) no Custom Search e grava com um clique no Storage + repositório do mapa.',
      ready: true,
      badge: 'Novo',
    },
    {
      href: '/admin/quick-add',
      title: 'Quick Add — mapa',
      desc: 'Loja + produtos/preços no mapa (stream SSE).',
      ready: true,
    },
    {
      href: '/mapa',
      title: 'Mapa (app)',
      desc: 'Ver o mapa como utilizador.',
      ready: true,
    },
    {
      href: '/mapa-quick-add',
      title: 'Atalho mapa + add',
      desc: 'Página pública de ajuda ao quick add.',
      ready: true,
    },
    {
      href: '/admin/bot-fila',
      title: 'Fila do Bot',
      desc: 'Promoções enviadas pelo scraper aguardando aprovação antes de publicar no mapa.',
      ready: true,
      badge: 'Novo',
    },
    {
      href: '/admin/financeiro',
      title: 'Financeiro',
      desc: 'Cruzar na BD quem tem cliente Stripe com plano, status da subscrição e flags ativas (só leitura).',
      ready: true,
      badge: 'Novo',
    },
  ];

  return (
    <>
      <Head>
        <title>Painel operacional — FinMemory</title>
      </Head>
      <div className="min-h-screen bg-[#f4f1ec] text-[#1a1a1a]">
        <header className="border-b border-black/10 bg-white/90 backdrop-blur px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight">Painel operacional</h1>
              <p className="text-sm text-gray-600">Mapa de preços e curadoria — mesmo deploy que o app.</p>
              <p className="mt-1 text-xs text-gray-500">
                Atalho no celular: com esta página aberta (já logado), Safari/Chrome → compartilhar → Adicionar à tela
                inicial — o atalho abre em <code className="rounded bg-black/5 px-1">/admin</code>, não na home do app.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="mt-2 inline-flex text-sm font-medium text-[#2ECC49] underline-offset-2 hover:underline sm:mt-0"
            >
              Voltar ao app
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
          <ul className="grid gap-4 sm:grid-cols-2">
            {cards.map((c) => (
              <li key={c.title}>
                {c.ready ? (
                  <Link
                    href={c.href}
                    className="block rounded-2xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-[#2ECC49]/40 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold text-[#111]">{c.title}</h2>
                      {c.badge ? (
                        <span className="rounded-full bg-[#2ECC49]/15 px-2.5 py-0.5 text-xs font-semibold text-[#1d8f35]">
                          {c.badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{c.desc}</p>
                    <span className="mt-3 inline-block text-sm font-medium text-[#2ECC49]">Abrir →</span>
                  </Link>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/15 bg-white/60 p-5 opacity-80">
                    <h2 className="font-semibold text-gray-700">{c.title}</h2>
                    <p className="mt-2 text-sm text-gray-500">{c.desc}</p>
                    <span className="mt-3 inline-block text-xs font-medium uppercase tracking-wide text-gray-400">
                      Em breve
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center text-xs text-gray-500">
            Produção: defina <code className="rounded bg-black/5 px-1">FINMEMORY_ADMIN_EMAILS</code> no Cloud Run
            para restringir este painel aos teus e-mails.
          </p>
        </main>
      </div>
    </>
  );
}
