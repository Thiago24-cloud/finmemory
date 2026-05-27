import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';

const DEFAULT_CATEGORY = 'Supermercado - Promoção';

function parseSseBuffer(buffer) {
  const events = [];
  let rest = buffer;
  const blocks = rest.split('\n\n');
  const incomplete = blocks.pop() ?? '';
  for (const block of blocks) {
    const lines = block.split('\n');
    let eventName = 'message';
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) {
      try {
        events.push({ event: eventName, data: JSON.parse(dataLines.join('\n')) });
      } catch {
        events.push({ event: eventName, data: { raw: dataLines.join('\n') } });
      }
    }
  }
  return { events, incomplete };
}

/**
 * Curadoria com feedback progressivo (POST + SSE).
 */
export function MapQuickAddFlow({ wazeUi }) {
  const [storeName, setStoreName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const [productsText, setProductsText] = useState('');
  const [secret, setSecret] = useState('');
  const [continueOnError, setContinueOnError] = useState(true);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState([]);
  const [productLines, setProductLines] = useState([]);
  const [summary, setSummary] = useState(null);
  const [fatalError, setFatalError] = useState('');

  const [clearPromoStoreName, setClearPromoStoreName] = useState('');
  const [clearPromoConfirm, setClearPromoConfirm] = useState(false);
  const [clearPromoMsg, setClearPromoMsg] = useState('');
  const [clearPromoBusy, setClearPromoBusy] = useState(false);

  const [removePinScope, setRemovePinScope] = useState('address');
  const [removePinStoreName, setRemovePinStoreName] = useState('');
  const [removePinAddress, setRemovePinAddress] = useState('');
  const [removePinConfirm, setRemovePinConfirm] = useState(false);
  const [removePinConfirmAllNames, setRemovePinConfirmAllNames] = useState(false);
  const [removePinClearPromoPoints, setRemovePinClearPromoPoints] = useState(false);
  const [removePinBlacklistCoords, setRemovePinBlacklistCoords] = useState(false);
  const [removePinConfirmBlacklist, setRemovePinConfirmBlacklist] = useState(false);
  const [removePinCuratedOptOut, setRemovePinCuratedOptOut] = useState(false);
  const [removePinConfirmCuratedOptOut, setRemovePinConfirmCuratedOptOut] = useState(false);
  const [removePinMsg, setRemovePinMsg] = useState('');
  const [removePinBusy, setRemovePinBusy] = useState(false);

  const cardClass = useMemo(
    () =>
      wazeUi
        ? 'rounded-2xl border border-[#3c4043] bg-[#1e2130] text-[#e8eaed] shadow-lg'
        : 'rounded-2xl border border-gray-200 bg-white text-gray-900 shadow-sm',
    [wazeUi]
  );
  const inputClass = useMemo(
    () =>
      wazeUi
        ? 'w-full rounded-xl border border-[#5f6368] bg-[#13161f] px-3 py-2 text-sm text-[#e8eaed] placeholder:text-[#9aa0a6]'
        : 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400',
    [wazeUi]
  );
  const labelClass = wazeUi ? 'text-xs font-semibold text-[#9aa0a6]' : 'text-xs font-semibold text-gray-600';

  const appendStep = useCallback((entry) => {
    setSteps((prev) => [...prev, { t: Date.now(), ...entry }]);
  }, []);

  const run = useCallback(async () => {
    setRunning(true);
    setSteps([]);
    setProductLines([]);
    setSummary(null);
    setFatalError('');

    const latNum = lat.trim() ? Number(lat.replace(',', '.')) : NaN;
    const lngNum = lng.trim() ? Number(lng.replace(',', '.')) : NaN;

    const payload = {
      store_name: storeName.trim(),
      address: address.trim() || undefined,
      category: category.trim() || null,
      productsText,
      continueOnError,
    };
    if (Number.isFinite(latNum) && Number.isFinite(lngNum)) {
      payload.lat = latNum;
      payload.lng = lngNum;
    }

    const headers = { 'Content-Type': 'application/json' };
    if (secret.trim()) headers['x-map-quick-add-secret'] = secret.trim();

    let res;
    try {
      res = await fetch('/api/map/quick-add-stream', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        credentials: 'include',
      });
    } catch (e) {
      setFatalError(e?.message || 'Falha de rede');
      setRunning(false);
      return;
    }

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      setFatalError(msg);
      setRunning(false);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      setFatalError('Stream não suportado neste browser');
      setRunning(false);
      return;
    }

    const dec = new TextDecoder();
    let buf = '';

    const applySseEvents = (events) => {
      for (const { event, data } of events) {
        if (event === 'step') {
          appendStep({ kind: 'step', ...data });
        } else if (event === 'product') {
          setProductLines((prev) => {
            const next = [...prev];
            const idx = next.findIndex((x) => x.index === data.index);
            if (idx >= 0) next[idx] = data;
            else next.push(data);
            return next;
          });
        } else if (event === 'done') {
          setSummary(data);
        } else if (event === 'error') {
          setFatalError(data.message || 'Erro');
          if (data.partial) setSummary(data.partial);
        }
      }
    };

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          buf += dec.decode(new Uint8Array(0), { stream: false });
          if (buf.trim()) {
            const { events } = parseSseBuffer(`${buf}\n\n`);
            applySseEvents(events);
          }
          break;
        }
        buf += dec.decode(value, { stream: true });
        const { events, incomplete } = parseSseBuffer(buf);
        buf = incomplete;
        applySseEvents(events);
      }
    } catch (e) {
      setFatalError(e?.message || 'Erro ao ler stream');
    } finally {
      setRunning(false);
    }
  }, [storeName, address, lat, lng, category, productsText, continueOnError, secret, appendStep]);

  const clearStoreMapPromos = useCallback(async () => {
    setClearPromoMsg('');
    setClearPromoBusy(true);
    const headers = { 'Content-Type': 'application/json' };
    if (secret.trim()) headers['x-map-quick-add-secret'] = secret.trim();
    try {
      const res = await fetch('/api/admin/clear-store-map-promos', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          store_name: clearPromoStoreName.trim(),
          confirm: true,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(j.matches)) {
        setClearPromoMsg(
          `${j.error || 'Ambíguo.'} Lojas: ${j.matches.map((m) => m.name).join(' · ')}`
        );
        return;
      }
      if (!res.ok) {
        setClearPromoMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      if (j.ok) {
        setClearPromoMsg(
          `Concluído. price_points: ${j.price_points_deleted ?? 0} · promotions: ${j.promotions_deactivated ?? 0} · agente: ${j.promocoes_supermercados_deactivated ?? 0}`
        );
        setClearPromoConfirm(false);
      } else {
        setClearPromoMsg(j.error || 'Resposta inesperada');
      }
    } catch (e) {
      setClearPromoMsg(e?.message || 'Erro de rede');
    } finally {
      setClearPromoBusy(false);
    }
  }, [clearPromoStoreName, secret]);

  const removeStoreFromMap = useCallback(async () => {
    setRemovePinMsg('');
    setRemovePinBusy(true);
    const headers = { 'Content-Type': 'application/json' };
    if (secret.trim()) headers['x-map-quick-add-secret'] = secret.trim();
    const scope = removePinScope === 'all' ? 'all_names' : 'address';
    const body = {
      store_name: removePinStoreName.trim(),
      scope,
      confirm: true,
    };
    if (scope === 'address') body.address = removePinAddress.trim();
    if (scope === 'all_names') body.confirm_remove_all_stores_with_name = true;
    if (removePinClearPromoPoints) body.clear_promotional_points = true;
    if (removePinBlacklistCoords) {
      body.blacklist_coordinates = true;
      body.confirm_blacklist_coordinates = removePinConfirmBlacklist;
    }
    if (removePinCuratedOptOut) {
      body.curated_pin_opt_out = true;
      body.confirm_curated_pin_opt_out = removePinConfirmCuratedOptOut;
    }
    try {
      const res = await fetch('/api/admin/remove-store-from-map', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 409 && Array.isArray(j.matches)) {
        setRemovePinMsg(
          `${j.error || 'Ambíguo.'} ${j.matches.map((m) => `${m.name} — ${m.address || ''}`).join(' | ')}`
        );
        return;
      }
      if (res.status === 404 && Array.isArray(j.candidates)) {
        setRemovePinMsg(
          `${j.error || 'Sem match.'} Endereços no cadastro: ${j.candidates.map((c) => c.address || '(vazio)').join(' · ')}`
        );
        return;
      }
      if (!res.ok) {
        setRemovePinMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      if (j.ok) {
        const extra = [];
        if (typeof j.promo_points_deleted === 'number')
          extra.push(`price_points promo: ${j.promo_points_deleted}`);
        if (typeof j.map_pin_suppressions_inserted === 'number')
          extra.push(`bloqueios: ${j.map_pin_suppressions_inserted}`);
        if (typeof j.curated_pin_opt_out_upserted === 'number' && j.curated_pin_opt_out_upserted > 0)
          extra.push(`opt-out curadoria: ${j.curated_pin_opt_out_upserted}`);
        setRemovePinMsg(
          `Concluído. ${j.deactivated_count ?? 0} loja(s) desativada(s).${extra.length ? ` ${extra.join(' · ')}.` : ''} ${j.note || ''}`.trim()
        );
        setRemovePinConfirm(false);
        setRemovePinConfirmAllNames(false);
        setRemovePinConfirmBlacklist(false);
        setRemovePinConfirmCuratedOptOut(false);
      } else {
        setRemovePinMsg(j.error || 'Resposta inesperada');
      }
    } catch (e) {
      setRemovePinMsg(e?.message || 'Erro de rede');
    } finally {
      setRemovePinBusy(false);
    }
  }, [
    removePinScope,
    removePinStoreName,
    removePinAddress,
    secret,
    removePinClearPromoPoints,
    removePinBlacklistCoords,
    removePinConfirmBlacklist,
    removePinCuratedOptOut,
    removePinConfirmCuratedOptOut,
  ]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 pb-24">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-bold ${wazeUi ? 'text-white' : 'text-gray-900'}`}>Curadoria rápida</h1>
          <p className={`mt-1 text-sm ${wazeUi ? 'text-[#9aa0a6]' : 'text-gray-600'}`}>
            Loja + lista com progresso ao vivo; miniaturas: repositório/cache → categorias por palavra-chave → Open Food Facts →
            Google CSE (loja + produto). Opcional no servidor: MAP_PRODUCT_IMAGE_VISION_VALIDATE=1. Gravar URL em
            /admin/quick-add reutiliza em todas as lojas.
          </p>
        </div>
        <Link
          href="/mapa"
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold no-underline ${
            wazeUi ? 'bg-[#3c4043] text-[#e8eaed] hover:bg-[#5f6368]' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
          }`}
        >
          Voltar ao mapa
        </Link>
      </div>

      <div className={`${cardClass} p-4 space-y-4`}>
        <div>
          <label className={labelClass}>Nome da loja</label>
          <input
            className={`mt-1 ${inputClass}`}
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            placeholder="Ex.: Sacolão São Jorge — Pinheiros"
            disabled={running}
          />
        </div>
        <div>
          <label className={labelClass}>Endereço (ajuda o geocode)</label>
          <input
            className={`mt-1 ${inputClass}`}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, número, bairro — SP"
            disabled={running}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Lat (opcional)</label>
            <input
              className={`mt-1 ${inputClass}`}
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="-23.56"
              disabled={running}
            />
          </div>
          <div>
            <label className={labelClass}>Lng (opcional)</label>
            <input
              className={`mt-1 ${inputClass}`}
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="-46.69"
              disabled={running}
            />
          </div>
        </div>
        <div>
          <label className={labelClass}>Categoria no mapa</label>
          <input
            className={`mt-1 ${inputClass}`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={running}
          />
        </div>
        <div>
          <label className={labelClass}>Produtos (JSON array ou linhas: nome;12,99)</label>
          <textarea
            className={`mt-1 min-h-[180px] font-mono text-xs ${inputClass}`}
            value={productsText}
            onChange={(e) => setProductsText(e.target.value)}
            placeholder={`[{"product_name":"Arroz 5kg","price":"12,99"}]\n\nou:\nArroz 5kg;12,99\nFeijão 1kg;8,50`}
            disabled={running}
          />
        </div>
        <div>
          <label className={labelClass}>Segredo (opcional — MAP_QUICK_ADD_SECRET)</label>
          <input
            className={`mt-1 ${inputClass}`}
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Só se usar bot/script sem sessão"
            disabled={running}
            autoComplete="off"
          />
        </div>
        <label className={`flex items-center gap-2 text-sm ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <input
            type="checkbox"
            checked={continueOnError}
            onChange={(e) => setContinueOnError(e.target.checked)}
            disabled={running}
          />
          Continuar após erro em um produto
        </label>

        <button
          type="button"
          onClick={run}
          disabled={running || !storeName.trim() || !productsText.trim()}
          className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
            wazeUi ? 'bg-[#1a73e8] hover:bg-[#1967d2]' : 'bg-[#2ECC49] hover:bg-[#22a83a]'
          }`}
        >
          {running ? 'A processar…' : 'Enviar com progresso ao vivo'}
        </button>
      </div>

      <div
        className={
          wazeUi
            ? 'mt-6 rounded-2xl border border-red-900/60 bg-[#2a1518]/80 p-4 space-y-3'
            : 'mt-6 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 space-y-3'
        }
      >
        <h2 className={`text-sm font-bold ${wazeUi ? 'text-[#f28b82]' : 'text-rose-900'}`}>
          Limpar ofertas no mapa (por loja)
        </h2>
        <p className={`text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-600'}`}>
          Remove ofertas promocionais divulgadas para o nome da loja (price_points com categoria promo, promotions e
          promocoes_supermercados). Mesma permissão que o envio acima (login ou segredo).
        </p>
        <div>
          <label className={labelClass}>Nome da loja a limpar</label>
          <input
            className={`mt-1 ${inputClass}`}
            value={clearPromoStoreName}
            onChange={(e) => setClearPromoStoreName(e.target.value)}
            placeholder="Igual ao cadastro / campo Nome da loja acima"
            disabled={clearPromoBusy || running}
          />
        </div>
        <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={clearPromoConfirm}
            onChange={(e) => setClearPromoConfirm(e.target.checked)}
            disabled={clearPromoBusy || running}
          />
          <span>Confirmo remoção das ofertas desta loja no mapa (irreversível).</span>
        </label>
        <button
          type="button"
          onClick={clearStoreMapPromos}
          disabled={clearPromoBusy || running || !clearPromoStoreName.trim() || !clearPromoConfirm}
          className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
            wazeUi ? 'bg-[#8b1e2d] hover:bg-[#a5273a]' : 'bg-rose-800 hover:bg-rose-900'
          }`}
        >
          {clearPromoBusy ? 'A processar…' : 'Remover ofertas desta loja'}
        </button>
        {clearPromoMsg ? (
          <p
            className={`text-xs whitespace-pre-wrap ${
              clearPromoMsg.startsWith('Concluído')
                ? wazeUi
                  ? 'text-[#81c995]'
                  : 'text-green-800'
                : wazeUi
                  ? 'text-[#f28b82]'
                  : 'text-red-700'
            }`}
          >
            {clearPromoMsg}
          </p>
        ) : null}
      </div>

      <div
        className={
          wazeUi
            ? 'mt-6 rounded-2xl border border-amber-900/50 bg-[#2d2419]/90 p-4 space-y-3'
            : 'mt-6 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 space-y-3'
        }
      >
        <h2 className={`text-sm font-bold ${wazeUi ? 'text-[#fdd663]' : 'text-amber-900'}`}>
          Retirar loja do mapa (cadastro)
        </h2>
        <p className={`text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-600'}`}>
          Desativa o pin (<code className={wazeUi ? 'text-[#fdd663]' : 'text-amber-800'}>active = false</code>). Duplicata:
          mesmo nome + endereço errado. &quot;Todas&quot; desativa todos os pins com esse nome.
        </p>
        <div>
          <label className={labelClass}>Nome da loja</label>
          <input
            className={`mt-1 ${inputClass}`}
            value={removePinStoreName}
            onChange={(e) => setRemovePinStoreName(e.target.value)}
            placeholder="Como no cadastro"
            disabled={removePinBusy || running}
          />
        </div>
        <div className={`space-y-2 text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="removePinScopeMq"
              className="mt-0.5"
              checked={removePinScope === 'address'}
              onChange={() => setRemovePinScope('address')}
              disabled={removePinBusy || running}
            />
            <span>Só esta filial (cole o endereço da linha errada)</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="radio"
              name="removePinScopeMq"
              className="mt-0.5"
              checked={removePinScope === 'all'}
              onChange={() => setRemovePinScope('all')}
              disabled={removePinBusy || running}
            />
            <span>Todas as lojas ativas com este nome</span>
          </label>
        </div>
        {removePinScope === 'address' ? (
          <div>
            <label className={labelClass}>Endereço a remover</label>
            <input
              className={`mt-1 ${inputClass}`}
              value={removePinAddress}
              onChange={(e) => setRemovePinAddress(e.target.value)}
              placeholder="Rua, número, bairro…"
              disabled={removePinBusy || running}
            />
          </div>
        ) : null}
        <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={removePinClearPromoPoints}
            onChange={(e) => setRemovePinClearPromoPoints(e.target.checked)}
            disabled={removePinBusy || running}
          />
          <span>Também apagar ofertas em price_points (promo) com o nome exato desta(s) loja(s).</span>
        </label>
        <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={removePinBlacklistCoords}
            onChange={(e) => {
              setRemovePinBlacklistCoords(e.target.checked);
              if (!e.target.checked) setRemovePinConfirmBlacklist(false);
            }}
            disabled={removePinBusy || running}
          />
          <span>Bloquear esta coordenada (mapa + find_or_create_store).</span>
        </label>
        {removePinBlacklistCoords ? (
          <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#fdd663]' : 'text-amber-900'}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={removePinConfirmBlacklist}
              onChange={(e) => setRemovePinConfirmBlacklist(e.target.checked)}
              disabled={removePinBusy || running}
            />
            <span>Confirmo gravar o bloqueio de coordenada.</span>
          </label>
        ) : null}
        <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={removePinCuratedOptOut}
            onChange={(e) => {
              setRemovePinCuratedOptOut(e.target.checked);
              if (!e.target.checked) setRemovePinConfirmCuratedOptOut(false);
            }}
            disabled={removePinBusy || running}
          />
          <span>Gravar opt-out Pomar/Sacolão (só com ofertas se reactivar).</span>
        </label>
        {removePinCuratedOptOut ? (
          <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#fdd663]' : 'text-amber-900'}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={removePinConfirmCuratedOptOut}
              onChange={(e) => setRemovePinConfirmCuratedOptOut(e.target.checked)}
              disabled={removePinBusy || running}
            />
            <span>Confirmo opt-out de curadoria.</span>
          </label>
        ) : null}
        <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}`}>
          <input
            type="checkbox"
            className="mt-0.5"
            checked={removePinConfirm}
            onChange={(e) => setRemovePinConfirm(e.target.checked)}
            disabled={removePinBusy || running}
          />
          <span>Confirmo desativar o(s) pin(s).</span>
        </label>
        {removePinScope === 'all' ? (
          <label className={`flex items-start gap-2 text-xs ${wazeUi ? 'text-[#fdd663]' : 'text-amber-900'}`}>
            <input
              type="checkbox"
              className="mt-0.5"
              checked={removePinConfirmAllNames}
              onChange={(e) => setRemovePinConfirmAllNames(e.target.checked)}
              disabled={removePinBusy || running}
            />
            <span>Entendo que TODAS as lojas com este nome serão desativadas.</span>
          </label>
        ) : null}
        <button
          type="button"
          onClick={removeStoreFromMap}
          disabled={
            removePinBusy ||
            running ||
            !removePinStoreName.trim() ||
            !removePinConfirm ||
            (removePinScope === 'address' && !removePinAddress.trim()) ||
            (removePinScope === 'all' && !removePinConfirmAllNames) ||
            (removePinBlacklistCoords && !removePinConfirmBlacklist) ||
            (removePinCuratedOptOut && !removePinConfirmCuratedOptOut)
          }
          className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-colors disabled:opacity-50 ${
            wazeUi ? 'bg-[#b06000] hover:bg-[#c87510]' : 'bg-amber-800 hover:bg-amber-900'
          }`}
        >
          {removePinBusy ? 'A processar…' : 'Desativar loja(s) no mapa'}
        </button>
        {removePinMsg ? (
          <p
            className={`text-xs whitespace-pre-wrap ${
              removePinMsg.startsWith('Concluído')
                ? wazeUi
                  ? 'text-[#81c995]'
                  : 'text-green-800'
                : wazeUi
                  ? 'text-[#f28b82]'
                  : 'text-red-700'
            }`}
          >
            {removePinMsg}
          </p>
        ) : null}
      </div>

      {fatalError ? (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            wazeUi ? 'border-red-800 bg-red-950/40 text-red-200' : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {fatalError}
        </div>
      ) : null}

      {steps.length > 0 ? (
        <div className={`mt-6 ${cardClass} p-4`}>
          <h2 className={`mb-2 text-sm font-bold ${wazeUi ? 'text-white' : 'text-gray-900'}`}>Etapas</h2>
          <ul className="space-y-2 text-sm">
            {steps.map((s, i) => (
              <li
                key={`${s.t}-${i}`}
                className={wazeUi ? 'text-[#bdc1c6]' : 'text-gray-700'}
              >
                <span className="font-mono text-xs opacity-70">{s.id}</span>{' '}
                <span
                  className={
                    s.status === 'error'
                      ? 'text-red-500'
                      : s.status === 'ok'
                        ? wazeUi
                          ? 'text-[#81c995]'
                          : 'text-green-600'
                        : ''
                  }
                >
                  {s.status}
                </span>
                {s.detail && Object.keys(s.detail).length ? (
                  <pre
                    className={`mt-1 overflow-x-auto rounded-lg p-2 text-xs ${
                      wazeUi ? 'bg-[#13161f] text-[#9aa0a6]' : 'bg-gray-50 text-gray-600'
                    }`}
                  >
                    {JSON.stringify(s.detail, null, 0)}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {productLines.length > 0 ? (
        <div className={`mt-6 ${cardClass} p-4`}>
          <h2 className={`mb-2 text-sm font-bold ${wazeUi ? 'text-white' : 'text-gray-900'}`}>Produtos</h2>
          <ul className="max-h-64 space-y-1 overflow-y-auto text-sm font-mono tabular-nums">
            {productLines
              .slice()
              .sort((a, b) => a.index - b.index)
              .map((p) => (
                <li key={p.index} className={wazeUi ? 'text-[#bdc1c6]' : 'text-gray-800'}>
                  {p.index}/{p.total}{' '}
                  <span className={p.status === 'error' ? 'text-red-500' : wazeUi ? 'text-[#81c995]' : 'text-green-600'}>
                    {p.status}
                  </span>{' '}
                  {p.name}
                  {p.message ? ` — ${p.message}` : ''}
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {summary && summary.ok ? (
        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            wazeUi ? 'border-[#81c995]/40 bg-[#1e3a2f]/50 text-[#e8eaed]' : 'border-green-200 bg-green-50 text-green-900'
          }`}
        >
          <span className="tabular-nums">
            Concluído: {summary.inserted} inseridos
            {summary.failed ? `, ${summary.failed} falhas` : ''}. Loja: {summary.store_name} ({summary.lat?.toFixed?.(5)},{' '}
            {summary.lng?.toFixed?.(5)}).
          </span>
        </div>
      ) : null}
    </div>
  );
}
