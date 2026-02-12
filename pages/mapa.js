import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { Search, ArrowLeft, PlusCircle, MessageCircle } from 'lucide-react';

const PriceMap = dynamic(() => import('../components/PriceMap'), { ssr: false });

export async function getServerSideProps() {
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
        <title>Mapa de Preços | FinMemory</title>
      </Head>
      <div className="flex flex-col h-screen bg-[#e5e3df]">
        {/* Banner de sucesso ao compartilhar */}
        {showSharedBanner && (
          <div className="bg-[#2ECC49] text-white px-4 py-2.5 text-center text-sm font-medium z-30 shrink-0">
            Preço compartilhado! Ele já aparece no mapa.
          </div>
        )}

        {/* Header: Voltar | Busca | Compartilhar preço */}
        <header className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-4 sm:py-2.5 bg-white/98 backdrop-blur-sm border-b border-gray-200 z-20 shrink-0">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 sm:gap-2 min-h-[44px] min-w-[44px] py-2 px-3 rounded-full hover:bg-gray-100 text-gray-700 transition-colors shrink-0 font-medium text-sm"
            aria-label="Voltar ao Dashboard"
          >
            <ArrowLeft className="h-5 w-5 shrink-0" />
            <span className="sm:hidden">Voltar</span>
          </Link>
          <div className="flex-1 flex items-center min-w-0">
            <div className="w-full max-w-xl flex items-center bg-gray-100 rounded-full border border-gray-200 pl-3 pr-3 py-2 focus-within:bg-white focus-within:ring-1 focus-within:ring-[#2ECC49] focus-within:border-[#2ECC49] transition-all">
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
            aria-label="Perguntar aos usuários"
            title="Perguntar à comunidade (ex.: tem salmão aí?)"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap hidden sm:inline">Perguntar</span>
          </button>
          <Link
            href="/share-price"
            className="inline-flex items-center gap-1.5 min-h-[44px] py-2 px-3 rounded-full bg-[#2ECC49] text-white font-medium text-sm hover:bg-[#22a83a] transition-colors shrink-0"
            aria-label="Compartilhar preço no mapa"
          >
            <PlusCircle className="h-5 w-5 shrink-0" />
            <span className="whitespace-nowrap">Compartilhar</span>
          </Link>
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

        {/* Mapa */}
        <div className="flex-1 relative min-h-0 w-full">
          <div className="absolute inset-0 w-full h-full">
            <PriceMap mapboxToken={mapboxToken} refreshQuestionsTrigger={questionRefresh} />
          </div>
          <p className="absolute bottom-2 left-2 text-[10px] sm:text-xs text-gray-500/90 z-10 pointer-events-none drop-shadow-sm">
            Preços compartilhados pela comunidade FinMemory
          </p>
        </div>
      </div>
    </>
  );
}
