import { useEffect, useState, useCallback } from 'react';
import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { getSupabase } from '../lib/supabase';
import { fetchPendingShoppingProductNames } from '../lib/fetchPendingShoppingNames';
import {
  getProximityAlertsStored,
  setProximityAlertsStored,
  getProximityRadiusM,
  setProximityRadiusM,
  PROXIMITY_RADIUS_PRESETS,
  startProximityMonitoring,
  stopProximityMonitoring,
} from '../lib/proximity/proximityAlerts';

/**
 * Alertas de proximidade (lista × mapa).
 * - App nativo (Capacitor): ativa monitoramento + notificações.
 * - Navegador: mostra explicação (GPS em segundo plano não existe no web).
 *
 * `pendingNames`: se omitido (undefined), carrega a lista automaticamente (útil em /settings).
 */
export default function ProximityAlertsSettings({ userId, pendingNames: pendingNamesProp }) {
  const [isNative, setIsNative] = useState(false);
  const [platform, setPlatform] = useState('web');
  const [enabled, setEnabled] = useState(false);
  const [radiusM, setRadiusM] = useState(350);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState('');
  const [fetchedNames, setFetchedNames] = useState([]);
  const [listLoading, setListLoading] = useState(false);

  const autoLoadList = pendingNamesProp === undefined || pendingNamesProp === null;
  const pendingNames = autoLoadList ? fetchedNames : pendingNamesProp;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Capacitor } = await import('@capacitor/core');
      if (!cancelled) {
        setIsNative(Capacitor.isNativePlatform());
        setPlatform(Capacitor.getPlatform());
        setEnabled(getProximityAlertsStored());
        setRadiusM(getProximityRadiusM());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoLoadList || !userId) return;
    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        const names = await fetchPendingShoppingProductNames(userId);
        if (!cancelled) setFetchedNames(names);
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, autoLoadList]);

  const namesKey = pendingNames.join('\u0000');

  useEffect(() => {
    if (!isNative || !userId) return;

    if (!enabled) {
      stopProximityMonitoring();
      return undefined;
    }

    if (pendingNames.length === 0) {
      stopProximityMonitoring();
      return undefined;
    }

    const supabase = getSupabase();
    if (!supabase) {
      setHint('Supabase indisponível.');
      return undefined;
    }

    let cancelled = false;
    setBusy(true);
    setHint('');

    (async () => {
      const result = await startProximityMonitoring({
        supabase,
        pendingProductNames: pendingNames,
        radiusM,
        onUnauthorized: () => {
          setHint(
            'Ative localização (ideal: "Sempre") e notificações para o FinMemory nas definições do aparelho.'
          );
        },
      });
      if (cancelled) return;
      setBusy(false);
      if (!result.ok) {
        if (result.reason === 'location' || result.reason === 'notifications') {
          setHint(
            'Permissões necessárias: localização e notificações. Pode ajustar nas definições do sistema.'
          );
        } else if (result.reason !== 'web') {
          setHint('Não foi possível iniciar o monitoramento.');
        }
      } else if (result.targets === 0) {
        setHint(
          'Nenhum ponto no mapa casou com os itens pendentes da lista (ainda). Quando houver preços no mapa, os alertas funcionam.'
        );
      } else {
        setHint('');
      }
    })();

    return () => {
      cancelled = true;
      stopProximityMonitoring({ clearTargets: false });
    };
  }, [isNative, userId, enabled, namesKey, pendingNames.length, radiusM]);

  const toggle = useCallback(async () => {
    const next = !enabled;
    setEnabled(next);
    setProximityAlertsStored(next);
    setHint('');
    if (!next) {
      await stopProximityMonitoring();
    }
  }, [enabled]);

  const onRadiusChange = useCallback((e) => {
    const v = Number(e.target.value);
    setRadiusM(v);
    setProximityRadiusM(v);
  }, []);

  if (!isNative) {
    return (
      <section className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-slate-200 p-2 text-slate-600">
            <Smartphone className="h-5 w-5" aria-hidden />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-[#333]">Alertas perto da loja</h2>
            <p className="text-xs text-gray-600 mt-1 leading-snug">
              Esta função usa GPS e notificações em <strong>segundo plano</strong>. Só está disponível na{' '}
              <strong>app FinMemory para Android ou iOS</strong> (instalada a partir da loja ou do build Capacitor),
              não no site aberto no Chrome ou Safari.
            </p>
            <p className="text-xs text-gray-500 mt-2 leading-snug">
              No telemóvel: abre a app → <strong>Lista de compras</strong> ou <strong>Ajustes</strong> → ativa
              &quot;Alertas de proximidade&quot;. Tens de ter itens <strong>por comprar</strong> na lista e pontos no
              mapa que coincidam com o nome do produto.
            </p>
            {platform !== 'web' ? (
              <p className="text-xs text-amber-800 mt-2">
                Ambiente: {platform}. Se esperavas ver o botão de ativar, confirma que estás na build nativa (não em
                &quot;Inspecionar&quot; do browser).
              </p>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-5 p-4 rounded-xl bg-white border border-gray-200 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-emerald-50 p-2 text-emerald-700">
          {enabled ? <Bell className="h-5 w-5" aria-hidden /> : <BellOff className="h-5 w-5" aria-hidden />}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-[#333]">Alertas perto da loja</h2>
          <p className="text-xs text-gray-500 mt-1 leading-snug">
            Avisa quando estiver dentro do raio que escolher abaixo de um ponto do mapa com produto parecido com
            os itens pendentes da lista. No Android aparece uma notificação persistente enquanto o monitor está
            ativo; no iOS, permissão de localização &quot;Sempre&quot; dá o melhor resultado em segundo plano.
          </p>
          {autoLoadList && listLoading ? (
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> A carregar itens da lista…
            </p>
          ) : null}
          <div className="mt-3">
            <label htmlFor="finmemory-proximity-radius" className="text-xs font-medium text-gray-600 block mb-1">
              Distância do aviso
            </label>
            <select
              id="finmemory-proximity-radius"
              value={radiusM}
              onChange={onRadiusChange}
              disabled={busy}
              className="w-full max-w-[220px] px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-[#333] focus:ring-2 focus:ring-[#2ECC49] focus:border-transparent disabled:opacity-50"
            >
              {PROXIMITY_RADIUS_PRESETS.map((m) => {
                const hintOpt =
                  m === 300
                    ? ' — área densa'
                    : m === 350
                      ? ' — equilibrado'
                      : m === 400
                        ? ' — mais margem'
                        : ' — ruas amplas / periferia';
                return (
                  <option key={m} value={m}>
                    {m} m{hintOpt}
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-gray-400 mt-1 leading-snug">
              300–350&nbsp;m costuma bastar em áreas densas; 400–500&nbsp;m dá mais margem em ruas largas ou
              periferia.
            </p>
          </div>
          <button
            type="button"
            onClick={toggle}
            disabled={busy || !userId || listLoading}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#2ECC49] hover:bg-[#22a83a] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {enabled ? 'Desativar alertas' : 'Ativar alertas de proximidade'}
          </button>
          {hint ? <p className="text-xs text-amber-800 mt-2 leading-snug">{hint}</p> : null}
        </div>
      </div>
    </section>
  );
}
