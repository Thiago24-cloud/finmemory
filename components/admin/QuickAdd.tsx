'use client';

import Link from 'next/link';
import { useRef, useState, type ChangeEvent } from 'react';
import { CURADORIA_STORE_PRESETS } from '../../lib/curadoriaStorePresets';

type CuradoriaPreset = (typeof CURADORIA_STORE_PRESETS)[number];

type StepStatus = 'idle' | 'pending' | 'ok' | 'error' | 'info';

interface PipelineStep {
  key: string;
  label: string;
  status: StepStatus;
  message: string;
}

const INITIAL_STEPS: PipelineStep[] = [
  { key: 'validate', label: 'Validação', status: 'idle', message: '' },
  { key: 'geocode', label: 'Geocoding', status: 'idle', message: '' },
  { key: 'dedup', label: 'Deduplicação', status: 'idle', message: '' },
  { key: 'store_insert', label: 'Inserir Loja', status: 'idle', message: '' },
  { key: 'products', label: 'Inserir Produtos', status: 'idle', message: '' },
];

function parseBrazilianPrice(raw: unknown): number {
  const t = String(raw ?? '').trim();
  if (!t) return NaN;
  if (t.includes(',')) {
    return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  }
  return parseFloat(t);
}

function parseProducts(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Lista de produtos vazia');

  if (trimmed.startsWith('[')) {
    const arr = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(arr)) throw new Error('JSON deve ser um array');
    return arr.map((p: Record<string, unknown>) => ({
      name: String(p.name ?? p.product_name ?? '').trim(),
      price: parseBrazilianPrice(p.price),
      ean: p.ean != null ? String(p.ean) : null,
      unit: p.unit != null ? String(p.unit) : 'un',
    })).filter((p) => p.name && Number.isFinite(p.price) && p.price >= 0);
  }

  const lines = trimmed.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const out: { name: string; price: number; ean: string | null; unit: string }[] = [];

  for (const line of lines) {
    if (line.includes(';')) {
      const parts = line.split(';').map((s) => s.trim());
      const name = parts[0];
      const price = parseBrazilianPrice(parts[1]);
      const ean = parts[2] || null;
      const unit = parts[3] || 'un';
      if (name && Number.isFinite(price) && price >= 0) {
        out.push({ name, price, ean, unit });
      }
      continue;
    }

    const semi = line.match(/^(.+?)\s*[;\t]\s*([\d.,]+)\s*$/);
    if (semi) {
      const price = parseBrazilianPrice(semi[2]);
      if (semi[1].trim() && Number.isFinite(price) && price >= 0) {
        out.push({ name: semi[1].trim(), price, ean: null, unit: 'un' });
      }
      continue;
    }

    const idx = line.lastIndexOf(',');
    if (idx > 0) {
      const name = line.slice(0, idx).trim();
      const priceRaw = line.slice(idx + 1).trim();
      if (name && /^[\d.,]+$/.test(priceRaw)) {
        const price = parseBrazilianPrice(priceRaw);
        if (Number.isFinite(price) && price >= 0) {
          out.push({ name, price, ean: null, unit: 'un' });
        }
      }
    }
  }

  if (!out.length) throw new Error('Nenhuma linha válida (use JSON, nome;preço ou nome,preço)');
  return out;
}

export default function QuickAdd() {
  const [uiMode, setUiMode] = useState<'manual' | 'vision'>('vision');
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [storeCnpj, setStoreCnpj] = useState('');
  const [productsRaw, setProductsRaw] = useState('');
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const [presetId, setPresetId] = useState<string>(CURADORIA_STORE_PRESETS[0]?.id ?? '');
  const [flyImageUrl, setFlyImageUrl] = useState('');
  const [flyImageB64, setFlyImageB64] = useState('');
  const [flyImageMime, setFlyImageMime] = useState('image/jpeg');
  const [visionBusy, setVisionBusy] = useState(false);
  const [visionDone, setVisionDone] = useState(false);
  const [visionError, setVisionError] = useState('');
  const [visionSummary, setVisionSummary] = useState('');

  const [cacheProductName, setCacheProductName] = useState('');
  const [cacheImageUrl, setCacheImageUrl] = useState('');
  const [cacheMsg, setCacheMsg] = useState('');
  const [cacheBusy, setCacheBusy] = useState(false);

  const selectedPreset: CuradoriaPreset | undefined = CURADORIA_STORE_PRESETS.find((p) => p.id === presetId);

  function updateStep(key: string, status: StepStatus, message: string) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, message } : s)));
  }

  async function run() {
    setError('');
    setDone(false);
    setProgress(0);
    setSteps(INITIAL_STEPS);
    setRunning(true);

    let products: ReturnType<typeof parseProducts>;
    try {
      products = parseProducts(productsRaw);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Formato inválido';
      setError(`Formato de produtos inválido: ${msg}`);
      setRunning(false);
      return;
    }

    const payload = {
      store: { name: storeName, address: storeAddress, cnpj: storeCnpj || undefined },
      products,
      category: 'Supermercado - Promoção',
    };

    abortRef.current = new AbortController();

    try {
      const res = await fetch('/api/admin/quick-add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortRef.current.signal,
        credentials: 'include',
      });

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) msg = j.error;
        } catch {
          /* ignore */
        }
        setError(msg);
        setRunning(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('Resposta sem corpo (stream)');
        setRunning(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      const consumeAdminSseBlocks = (blocks: string[]) => {
        for (const block of blocks) {
          if (!block.trim()) continue;
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '));
          if (!dataLine) continue;
          let event: {
            step: string;
            status?: StepStatus;
            message?: string;
            data?: { progress?: number };
          };
          try {
            event = JSON.parse(dataLine.slice(6)) as typeof event;
          } catch {
            continue;
          }

          if (event.step === 'done') {
            setDone(true);
            setRunning(false);
          } else if (event.step === 'fatal') {
            setError(event.message || 'Erro fatal');
            setRunning(false);
          } else if (event.step && event.status) {
            updateStep(event.step, event.status, event.message || '');
            if (event.data?.progress != null) setProgress(event.data.progress);
          }
        }
      };

      for (;;) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) {
          buffer += decoder.decode(new Uint8Array(0), { stream: false });
          if (buffer.trim()) {
            consumeAdminSseBlocks((buffer + '\n\n').split('\n\n'));
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split('\n\n');
        buffer = blocks.pop() ?? '';
        consumeAdminSseBlocks(blocks);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(`Erro de conexão: ${err.message}`);
      }
      setRunning(false);
    }
  }

  function reset() {
    abortRef.current?.abort();
    setSteps(INITIAL_STEPS);
    setRunning(false);
    setDone(false);
    setError('');
    setProgress(0);
  }

  function resetVision() {
    setVisionBusy(false);
    setVisionDone(false);
    setVisionError('');
    setVisionSummary('');
    setFlyImageB64('');
    setFlyImageMime('image/jpeg');
  }

  function onFlyerFileChange(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFlyImageUrl('');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (m) {
        setFlyImageMime(m[1] || 'image/jpeg');
        setFlyImageB64(m[2] || '');
      }
    };
    reader.readAsDataURL(f);
  }

  async function runVisionExtract() {
    setVisionError('');
    setVisionSummary('');
    setVisionDone(false);
    const preset = selectedPreset;
    if (!preset) {
      setVisionError('Escolha uma loja preset.');
      return;
    }
    if (!flyImageB64.trim() && !flyImageUrl.trim()) {
      setVisionError('Cole URL https pública da imagem ou envie um arquivo (print / story).');
      return;
    }

    setVisionBusy(true);
    try {
      const body: Record<string, unknown> = {
        supermercado: preset.supermercado,
        storeName: preset.storeName,
        geocodeQuery: preset.geocodeQuery,
        lat: preset.lat,
        lng: preset.lng,
        flyerKey: `quickadd-${Date.now()}`,
        replacePrevious: true,
      };
      if (flyImageB64.trim()) {
        body.imageBase64 = flyImageB64.trim();
        body.imageMimeType = flyImageMime;
      } else {
        body.imageUrl = flyImageUrl.trim();
      }

      const res = await fetch('/api/promotions/extract-flyer-vision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });

      const j = (await res.json()) as {
        ok?: boolean;
        inserted?: number;
        insertedPromotions?: number;
        error?: string;
        note?: string;
        rawCount?: number;
      };

      if (!res.ok) {
        setVisionError(j.error || `HTTP ${res.status}`);
        return;
      }

      if (j.ok) {
        setVisionDone(true);
        setVisionSummary(
          `Agente: ${j.inserted ?? 0} linha(s). Promoções (mapa): ${j.insertedPromotions ?? 0}. ${j.note || ''}`.trim()
        );
      } else {
        setVisionError(j.error || 'Resposta inesperada');
      }
    } catch (err: unknown) {
      setVisionError(err instanceof Error ? err.message : 'Falha de rede');
    } finally {
      setVisionBusy(false);
    }
  }

  async function saveProductImageToRepository() {
    setCacheMsg('');
    setCacheBusy(true);
    try {
      const res = await fetch('/api/map/cache-product-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_name: cacheProductName.trim(),
          image_url: cacheImageUrl.trim(),
        }),
        credentials: 'include',
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setCacheMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      setCacheMsg('Gravado. Próximos Quick Adds com este nome reutilizam a miniatura (sem gastar de novo).');
      setCacheImageUrl('');
    } catch (e: unknown) {
      setCacheMsg(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setCacheBusy(false);
    }
  }

  const statusIcon: Record<StepStatus, string> = {
    idle: '○',
    pending: '◌',
    ok: '✓',
    error: '✗',
    info: '⚠',
  };

  const statusColor: Record<StepStatus, string> = {
    idle: 'text-gray-400',
    pending: 'text-blue-400 animate-pulse',
    ok: 'text-green-400',
    error: 'text-red-400',
    info: 'text-yellow-400',
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
      <div className="max-w-2xl mx-auto">
        <p className="mb-3 text-xs text-gray-500">
          <Link href="/admin" className="text-emerald-400/90 underline-offset-2 hover:underline">
            ← Painel operacional
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-white mb-1">⚡ Quick Add</h1>
        <p className="text-gray-500 text-sm mb-4">
          Mapa de preços: lista manual grava preço + tenta miniatura (cache → Open Food Facts → Google CSE). Uma vez gravada a
          foto do &quot;Filé mignon&quot; ou &quot;Manga Palmer&quot;, reutiliza em qualquer loja — sem reler o print.
        </p>

        <div className="mb-8 rounded-2xl border border-emerald-900/50 bg-emerald-950/15 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400/90">Repositório de miniaturas</h2>
          <p className="text-xs text-gray-400">
            Cole o URL https da foto real (ex. do teu print hospedado). O nome deve bater com o que vais usar na lista (ex.{' '}
            <span className="text-gray-300">Manga Palmer</span>).
          </p>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
            value={cacheProductName}
            onChange={(e) => setCacheProductName(e.target.value)}
            placeholder="Nome do produto (ex. Filé mignon)"
            disabled={cacheBusy}
          />
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-600"
            value={cacheImageUrl}
            onChange={(e) => setCacheImageUrl(e.target.value)}
            placeholder="https://… (imagem jpg/png/webp)"
            disabled={cacheBusy}
          />
          <button
            type="button"
            onClick={saveProductImageToRepository}
            disabled={cacheBusy || !cacheProductName.trim() || !cacheImageUrl.trim()}
            className="w-full bg-emerald-700 hover:bg-emerald-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold py-2 rounded uppercase tracking-wide"
          >
            {cacheBusy ? 'A gravar…' : 'Gravar no repositório'}
          </button>
          {cacheMsg ? (
            <p
              className={`text-xs ${cacheMsg.startsWith('Gravado') ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {cacheMsg}
            </p>
          ) : null}
        </div>

        <div className="flex gap-2 mb-8">
          <button
            type="button"
            onClick={() => {
              setUiMode('vision');
              setError('');
              reset();
              resetVision();
            }}
            className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide ${
              uiMode === 'vision' ? 'bg-violet-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Print / Instagram (automático)
          </button>
          <button
            type="button"
            onClick={() => {
              setUiMode('manual');
              resetVision();
            }}
            className={`flex-1 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wide ${
              uiMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Lista manual
          </button>
        </div>

        {uiMode === 'vision' && (
          <div className="space-y-4 mb-10 rounded-2xl border border-violet-900/60 bg-violet-950/20 p-4">
            <p className="text-xs text-violet-200/90">
              A loja e o endereço vêm do preset — você só manda a captura. Exige login e{' '}
              <code className="text-violet-300">OPENAI_API_KEY</code> no servidor.
            </p>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Loja (preset)</label>
              <select
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                disabled={visionBusy}
              >
                {CURADORIA_STORE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">
                URL da imagem (https público, opcional se enviar arquivo)
              </label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-violet-500"
                value={flyImageUrl}
                onChange={(e) => {
                  setFlyImageUrl(e.target.value);
                  if (e.target.value.trim()) {
                    setFlyImageB64('');
                  }
                }}
                placeholder="https://…"
                disabled={visionBusy}
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">
                Arquivo — print, story, screenshot
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="w-full text-sm text-gray-300 file:mr-3 file:rounded file:border-0 file:bg-violet-700 file:px-3 file:py-1.5 file:text-white"
                onChange={onFlyerFileChange}
                disabled={visionBusy}
              />
              {flyImageB64 ? (
                <p className="text-xs text-green-400 mt-1">Imagem carregada ({Math.round(flyImageB64.length / 1024)} KB base64)</p>
              ) : null}
            </div>

            {visionError ? (
              <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">✗ {visionError}</p>
            ) : null}

            {!visionDone ? (
              <button
                type="button"
                onClick={runVisionExtract}
                disabled={visionBusy || !selectedPreset}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded text-sm tracking-widest uppercase"
              >
                {visionBusy ? 'A extrair com Vision…' : 'Extrair e publicar no mapa →'}
              </button>
            ) : (
              <div className="text-center space-y-3">
                <div className="text-green-400 text-3xl">✓</div>
                <p className="text-green-300 text-sm font-semibold">{visionSummary || 'Concluído.'}</p>
                <button
                  type="button"
                  onClick={resetVision}
                  className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded text-sm"
                >
                  + Outra imagem
                </button>
              </div>
            )}
          </div>
        )}

        {uiMode === 'manual' && !running && !done && (
          <div className="space-y-4 mb-8">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Nome da Loja *</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Ex: Pomar da Vila"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Endereço *</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                placeholder="Ex: Rua Harmonia, 123, Vila Madalena, SP"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">CNPJ (opcional)</label>
              <input
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                value={storeCnpj}
                onChange={(e) => setStoreCnpj(e.target.value)}
                placeholder="00.000.000/0001-00"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">
                Produtos — JSON ou linhas (nome;12,99 ou nome,12,99) *
              </label>
              <textarea
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 h-40 resize-none"
                value={productsRaw}
                onChange={(e) => setProductsRaw(e.target.value)}
                placeholder={`JSON:\n[{"name":"Arroz 5kg","price":24.90}]\n\nLinhas:\nArroz 5kg;24,90\nFeijão 1kg,8,50`}
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-950 border border-red-800 rounded px-3 py-2">✗ {error}</p>
            )}

            <button
              type="button"
              onClick={run}
              disabled={!storeName || !storeAddress || !productsRaw}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded transition-colors text-sm tracking-widest uppercase"
            >
              Executar Pipeline →
            </button>
          </div>
        )}

        {uiMode === 'manual' && (running || done || steps.some((s) => s.status !== 'idle')) && (
          <div className="mb-6">
            <div className="space-y-3">
              {steps.map((step) => (
                <div
                  key={step.key}
                  className={`flex items-start gap-3 p-3 rounded border transition-all duration-300 ${
                    step.status === 'ok'
                      ? 'border-green-800 bg-green-950/30'
                      : step.status === 'error'
                        ? 'border-red-800 bg-red-950/30'
                        : step.status === 'pending'
                          ? 'border-blue-800 bg-blue-950/30'
                          : step.status === 'info'
                            ? 'border-yellow-800 bg-yellow-950/30'
                            : 'border-gray-800 bg-gray-900/30'
                  }`}
                >
                  <span className={`text-lg leading-none mt-0.5 ${statusColor[step.status]}`}>
                    {statusIcon[step.status]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-gray-400">{step.label}</span>
                    </div>
                    {step.message && (
                      <p
                        className={`text-sm mt-0.5 break-words tabular-nums ${statusColor[step.status]}`}
                      >
                        {step.message}
                      </p>
                    )}
                    {step.key === 'products' && step.status === 'pending' && progress > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {uiMode === 'manual' && done && (
          <div className="text-center">
            <div className="text-green-400 text-4xl mb-2">✓</div>
            <p className="text-green-300 font-bold mb-4">Pipeline concluído com sucesso!</p>
            <button
              type="button"
              onClick={reset}
              className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded text-sm"
            >
              + Adicionar outra loja
            </button>
          </div>
        )}

        {uiMode === 'manual' && running && (
          <button
            type="button"
            onClick={reset}
            className="w-full text-gray-500 hover:text-red-400 text-xs py-2 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
