'use client';

import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Loader2, LogOut } from 'lucide-react';
import { EQUIPE_ME_API } from '../../../lib/merchant/painelApiPaths';
import { EQUIPE_PAPEL_LABEL, EQUIPE_TABS_BY_PAPEL } from '../../../lib/merchant/equipe/equipeConstants';
import { MerchantGarcomSection } from '../../../components/merchant/restaurant/MerchantGarcomSection';
import { MerchantCozinhaSection } from '../../../components/merchant/restaurant/MerchantCozinhaSection';
import { MerchantCaixaSection } from '../../../components/merchant/restaurant/MerchantCaixaSection';
import { MerchantMesasSection } from '../../../components/merchant/restaurant/MerchantMesasSection';
import { MerchantHistoricoSection } from '../../../components/merchant/restaurant/MerchantHistoricoSection';

export default function EquipeWorkspacePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [membro, setMembro] = useState(null);
  const [store, setStore] = useState(null);
  const [tab, setTab] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(EQUIPE_ME_API);
      if (res.status === 401) {
        await router.replace('/parceiros/equipe/entrar');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        await router.replace('/parceiros/equipe/entrar');
        return;
      }
      setMembro(data.membro);
      setStore(data.store);
      const tabs = EQUIPE_TABS_BY_PAPEL[data.membro?.papel] || [];
      setTab(tabs[0] || null);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async () => {
    await fetch(EQUIPE_ME_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout' }),
    });
    await router.replace('/parceiros/equipe/entrar');
  };

  const tabs = EQUIPE_TABS_BY_PAPEL[membro?.papel] || [];
  const tabLabels = {
    garcom: 'Garçom',
    mesas: 'Mesas',
    cozinha: 'Cozinha',
    caixa: 'Caixa',
    historico: 'Histórico',
  };

  return (
    <>
      <Head>
        <title>
          {membro ? `${EQUIPE_PAPEL_LABEL[membro.papel] || 'Equipe'} — ${store?.name || ''}` : 'Equipe'}
        </title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <meta name="robots" content="noindex" />
      </Head>

      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="min-h-screen bg-background text-foreground pb-24">
          <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground m-0">
                {EQUIPE_PAPEL_LABEL[membro?.papel] || 'Equipe'}
              </p>
              <p className="font-bold text-sm m-0 truncate">
                {membro?.nome} · {store?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground bg-transparent cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </button>
          </header>

          <main className="max-w-2xl mx-auto p-4">
            {tab === 'garcom' ? <MerchantGarcomSection lojaId={store?.id} /> : null}
            {tab === 'cozinha' ? <MerchantCozinhaSection lojaId={store?.id} /> : null}
            {tab === 'caixa' ? <MerchantCaixaSection lojaId={store?.id} /> : null}
            {tab === 'mesas' ? <MerchantMesasSection /> : null}
            {tab === 'historico' ? <MerchantHistoricoSection /> : null}
          </main>

          {tabs.length > 1 ? (
            <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card safe-area-bottom">
              <div className="max-w-2xl mx-auto flex">
                {tabs.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-xs font-bold border-0 cursor-pointer ${
                      tab === t ? 'text-primary bg-primary/5' : 'text-muted-foreground bg-transparent'
                    }`}
                  >
                    {tabLabels[t] || t}
                  </button>
                ))}
              </div>
            </nav>
          ) : null}
        </div>
      )}
    </>
  );
}
