import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession, signIn } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { Search, ArrowLeft, PlusCircle, MessageCircle } from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccess } from '../lib/access-server';

const PriceMap = dynamic(() => import('../components/PriceMap'), { ssr: false });

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!session?.user?.email) {
    return { redirect: { destination: '/login?callbackUrl=/mapa', permanent: false } };
  }
  const allowed = await canAccess(session.user.email);
  if (!allowed) {
    return { redirect: { destination: '/?msg=nao-cadastrado', permanent: false } };
  }
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || '';
  return { props: { mapboxToken: token } };
}

export default function MapaPage({ mapboxToken }) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [showSharedBanner, setShowSharedBanner] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [questionMessage, setQuestionMessage] = useState('');
  const [questionStore, setQuestionStore] = useState('');
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [questionError, setQuestionError] = useState('');
  const [questionRefresh, setQuestionRefresh] = useState(0);
  const [questionLocation, setQuestionLocation] = useState(null);

  useEffect(() => {
    if (router.query.shared === '1') {
      setShowSharedBanner(true);
      const t = setTimeout(() => setShowSharedBanner(false), 5000);
      return () => clearTimeout(t);
    }
  }, [router.query.shared]);

  const handleSubmitQuestion = async (e) => {
    e.preventDefault();
    setQuestionError('');
    if (!questionMessage.trim() || questionMessage.trim().length < 3) {
      setQuestionError('Digite sua pergunta (mín. 3 caracteres).');
      return;
    }
    setQuestionSubmitting(true);
    try {
      const res = await fetch('/api/map/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: questionMessage.trim(),
          store_name: questionStore.trim() || null,
          lat: questionLocation?.lat ?? null,
          lng: questionLocation?.lng ?? null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuestionError(data.error || 'Erro ao publicar. Tente de novo.');
        return;
      }
      setQuestionMessage('');
      setQuestionStore('');
      setQuestionLocation(null);
      setShowQuestionModal(false);
      setQuestionRefresh((c) => c + 1);
    } catch (err) {
      setQuestionError('Erro de conexão. Tente de novo.');
    } finally {
      setQuestionSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>FinMemory – Onde está mais barato? | App de compras e análise de custos</title>
      </Head>
      {/* Mapa em tela cheia = primeira coisa que o usuário vê */}
      <div className="fixed inset-0 w-full h-full bg-[#e5e3df]">
        <div className="absolute inset-0 w-full h-full">
          {mapboxToken ? (
            <PriceMap mapboxToken={mapboxToken} refreshQuestionsTrigger={questionRefresh} />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-6">
              <div className="max-w-md bg-white/95 backdrop-blur rounded-2xl shadow-lg p-8 text-center">
                <h2 className="text-xl font-bold text-gray-800 mb-2">Mapa temporariamente indisponível</h2>
                <p className="text-gray-600 text-sm mb-6">
                  O mapa de preços precisa do token Mapbox. Em produção, configure <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> no deploy.
                </p>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-2 py-3 px-5 bg-[#2ECC49] text-white font-semibold rounded-xl hover:bg-[#22a83a]"
                >
                  Ir para Gastos
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Banner de sucesso ao compartilhar */}
        {showSharedBanner && (
          <div className="absolute top-14 left-4 right-4 z-30 bg-[#2ECC49] text-white px-4 py-2.5 rounded-xl text-center text-sm font-medium shadow-lg">
            Preço compartilhado! Ele já aparece no mapa.
          </div>
        )}

        {/* Header flutuante sobre o mapa – minimalista */}
        <header className="absolute top-0 left-0 right-0 z-20 flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white/90 backdrop-blur-md border-b border-gray-200/80 shadow-sm">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 min-h-[44px] min-w-[44px] py-2 px-3 rounded-full hover:bg-gray-100 text-gray-700 transition-colors shrink-0 font-medium text-sm"
                aria-label="Análise de gastos"
              >
                <ArrowLeft className="h-5 w-5 shrink-0" />
                <span className="sm:inline hidden">Gastos</span>
              </Link>
              <div className="flex-1 flex items-center min-w-0 max-w-[200px] sm:max-w-xs">
                <div className="w-full flex items-center bg-gray-100/90 rounded-full pl-3 pr-3 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2ECC49] transition-all">
                  <Search className="h-4 w-4 text-gray-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    placeholder="Buscar produto..."
                    className="flex-1 min-w-0 bg-transparent border-0 text-gray-800 placeholder-gray-500 focus:outline-none text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionModal(true)}
                className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 transition-colors shrink-0"
                aria-label="Perguntar à comunidade"
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap hidden sm:inline">Perguntar</span>
              </button>
              <Link
                href="/share-price"
                className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-[#2ECC49] text-white font-medium text-sm hover:bg-[#22a83a] transition-colors shrink-0"
                aria-label="Compartilhar preço"
              >
                <PlusCircle className="h-5 w-5 shrink-0" />
                <span className="whitespace-nowrap hidden sm:inline">Compartilhar</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/mapa" className="font-bold text-[#333] text-lg shrink-0">
                FinMemory
              </Link>
              <span className="flex-1 text-xs text-gray-500 hidden sm:block">App de compras · Onde está mais barato?</span>
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/mapa' })}
                className="min-h-[40px] py-2 px-4 rounded-full bg-[#2ECC49] text-white font-semibold text-sm hover:bg-[#22a83a] transition-colors"
              >
                Entrar
              </button>
              <Link
                href="/dashboard"
                className="min-h-[40px] py-2 px-3 rounded-full border border-gray-300 bg-white/80 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
              >
                Gastos
              </Link>
            </>
          )}
        </header>

        {/* Modal: Perguntar aos usuários */}
        {showQuestionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="question-modal-title">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-5">
              <h2 id="question-modal-title" className="text-lg font-bold text-gray-900 mb-3">
                Perguntar à comunidade
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                Ex.: &quot;Tem salmão defumado no estoque?&quot; ou &quot;Alguém viu preço do azeite?&quot;
              </p>
              {!session && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3 mb-4">
                  Faça login para publicar sua pergunta.
                </p>
              )}
              <form onSubmit={handleSubmitQuestion}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sua pergunta *</label>
                <textarea
                  value={questionMessage}
                  onChange={(e) => setQuestionMessage(e.target.value)}
                  placeholder="Ex.: Tem salmão defumado aí?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm resize-none"
                  disabled={!session}
                />
                <label className="block text-sm font-medium text-gray-700 mt-3 mb-1">Local (opcional)</label>
                <input
                  type="text"
                  value={questionStore}
                  onChange={(e) => setQuestionStore(e.target.value)}
                  placeholder="Ex.: Extra Lapa"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                  disabled={!session}
                />
                {session && (
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setQuestionError('Geolocalização não disponível.');
                          return;
                        }
                        navigator.geolocation.getCurrentPosition(
                          (pos) => setQuestionLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                          () => setQuestionError('Não foi possível obter localização.')
                        );
                      }}
                      className="text-sm text-amber-600 hover:text-amber-700 font-medium"
                    >
                      {questionLocation ? '✓ Minha localização adicionada' : 'Usar minha localização (aparece no mapa)'}
                    </button>
                  </div>
                )}
                {questionError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">{questionError}</p>
                )}
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => { setShowQuestionModal(false); setQuestionError(''); }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!session || questionSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {questionSubmitting ? 'Enviando...' : 'Publicar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tagline: posicionamento compras → análise de custos */}
        <p className="absolute bottom-2 left-2 right-2 sm:left-4 sm:right-auto text-[10px] sm:text-xs text-white/95 z-10 pointer-events-none drop-shadow-md max-w-md">
          App de compras: preços e comunidade. Sua <Link href="/dashboard" className="underline pointer-events-auto hover:text-white">análise de custos</Link> em Gastos.
        </p>
      </div>
    </>
  );
}
