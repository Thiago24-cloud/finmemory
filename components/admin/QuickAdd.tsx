'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
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

function formatCnpjFromDigits(digits: string) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length !== 14) return digits;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`;
}

function digitsOnlyCnpjInput(raw: string) {
  return String(raw || '').replace(/\D/g, '');
}

/** Uma unidade: `endereço completo` + Tab ou `|` + CNPJ. Sem separador = só endereço (CNPJ vem do repositório ao executar). */
function parseFranchiseUnitLine(line: string): { address: string; cnpjDigits: string } | null {
  const raw = line.trim();
  if (!raw) return null;
  const tab = raw.indexOf('\t');
  if (tab !== -1) {
    return {
      address: raw.slice(0, tab).trim(),
      cnpjDigits: digitsOnlyCnpjInput(raw.slice(tab + 1)),
    };
  }
  const pipe = raw.lastIndexOf('|');
  if (pipe > 0) {
    const maybeAddr = raw.slice(0, pipe).trim();
    const maybeCnpj = digitsOnlyCnpjInput(raw.slice(pipe + 1));
    if (maybeCnpj.length === 14) {
      return { address: maybeAddr, cnpjDigits: maybeCnpj };
    }
  }
  return { address: raw, cnpjDigits: '' };
}

async function fetchBookCnpjDigits(storeName: string, address: string): Promise<string | null> {
  const n = storeName.trim();
  const a = address.trim();
  if (n.length < 2 || a.length < 4) return null;
  try {
    const qs = new URLSearchParams({ address: a, store_name: n });
    const r = await fetch(`/api/admin/store-address-book?${qs.toString()}`, { credentials: 'include' });
    const j = (await r.json()) as { match?: { cnpj_digits?: string } | null };
    if (r.ok && j.match?.cnpj_digits && String(j.match.cnpj_digits).length === 14) {
      return String(j.match.cnpj_digits);
    }
  } catch {
    /* ignore */
  }
  return null;
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

  const [cacheLogoStoreName, setCacheLogoStoreName] = useState('');
  const [cacheLogoUrl, setCacheLogoUrl] = useState('');
  const [cacheLogoMsg, setCacheLogoMsg] = useState('');
  const [cacheLogoBusy, setCacheLogoBusy] = useState(false);

  const [clearPromoStoreName, setClearPromoStoreName] = useState('');
  const [clearPromoConfirm, setClearPromoConfirm] = useState(false);
  const [clearPromoMsg, setClearPromoMsg] = useState('');
  const [clearPromoBusy, setClearPromoBusy] = useState(false);

  const [removePinScope, setRemovePinScope] = useState<'address' | 'all'>('address');
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

  /** Repositório admin: CNPJ + endereços já usados (evita repetir; franquia = vários endereços). */
  const [storeKind, setStoreKind] = useState<'isolated' | 'franchise'>('isolated');
  /** Modo franquia: uma linha por unidade — `endereço [Tab ou |] CNPJ`; só endereço se o CNPJ já estiver no repositório. */
  const [franchiseUnitsRaw, setFranchiseUnitsRaw] = useState('');
  const [franchiseBookFillBusy, setFranchiseBookFillBusy] = useState(false);
  const [franchiseBookFillMsg, setFranchiseBookFillMsg] = useState('');
  const [bookHints, setBookHints] = useState<
    { store_name: string; address_raw: string; cnpj_digits: string; is_franchise: boolean }[]
  >([]);
  const [bookLoading, setBookLoading] = useState(false);

  const [curatedOptStoreId, setCuratedOptStoreId] = useState('');
  const [curatedOptNote, setCuratedOptNote] = useState('');
  const [curatedOptConfirm, setCuratedOptConfirm] = useState(false);
  const [curatedOptMsg, setCuratedOptMsg] = useState('');
  const [curatedOptBusy, setCuratedOptBusy] = useState(false);

  const selectedPreset: CuradoriaPreset | undefined = CURADORIA_STORE_PRESETS.find((p) => p.id === presetId);

  function updateStep(key: string, status: StepStatus, message: string) {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, message } : s)));
  }

  const saveBookRow = useCallback(
    async (addressLine: string, cnpjDigits: string) => {
      const d = digitsOnlyCnpjInput(cnpjDigits);
      if (d.length !== 14 || !storeName.trim() || !addressLine.trim()) return;
      try {
        await fetch('/api/admin/store-address-book', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            store_name: storeName.trim(),
            address: addressLine.trim(),
            cnpj: d,
            is_franchise: storeKind === 'franchise',
          }),
        });
      } catch {
        /* silencioso — repositório é auxiliar */
      }
    },
    [storeName, storeKind]
  );

  async function runPipelineOnce(
    addr: string,
    products: ReturnType<typeof parseProducts>,
    batchHint?: string,
    cnpjForUnit?: string
  ): Promise<'done' | 'fatal' | 'error'> {
    const cnpjDigits = cnpjForUnit != null ? digitsOnlyCnpjInput(cnpjForUnit) : digitsOnlyCnpjInput(storeCnpj);
    const cnpjPayload =
      cnpjDigits.length === 14 ? formatCnpjFromDigits(cnpjDigits) : undefined;
    const payload = {
      store: { name: storeName, address: addr, cnpj: cnpjPayload },
      products,
      category: 'Supermercado - Promoção',
    };

    abortRef.current = new AbortController();
    let outcome: 'done' | 'fatal' | 'error' = 'error';

    if (batchHint) {
      updateStep('validate', 'pending', batchHint);
    }

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
          outcome = 'done';
        } else if (event.step === 'fatal') {
          setError(event.message || 'Erro fatal');
          outcome = 'fatal';
        } else if (event.step && event.status) {
          updateStep(event.step, event.status, event.message || '');
          if (event.data?.progress != null) setProgress(event.data.progress);
        }
      }
    };

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
        return 'error';
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError('Resposta sem corpo (stream)');
        return 'error';
      }

      const decoder = new TextDecoder();
      let buffer = '';

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
      return 'error';
    }

    return outcome;
  }

  async function run() {
    setError('');
    setDone(false);
    setProgress(0);
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

    const name = storeName.trim();
    if (!name) {
      setError('Informe o nome da loja.');
      setRunning(false);
      return;
    }

    type Unit = { address: string; cnpjDigits: string };
    let units: Unit[];

    if (storeKind === 'franchise') {
      const lines = franchiseUnitsRaw.split(/\n/).map((l) => l.trim()).filter(Boolean);
      if (!lines.length) {
        setError('No modo franquia, indique pelo menos uma linha (uma unidade por linha).');
        setRunning(false);
        return;
      }
      const built: Unit[] = [];
      for (let li = 0; li < lines.length; li += 1) {
        const parsed = parseFranchiseUnitLine(lines[li]);
        if (!parsed || !parsed.address) {
          setError(`Linha ${li + 1}: endereço inválido ou vazio.`);
          setRunning(false);
          return;
        }
        let { address, cnpjDigits } = parsed;
        if (cnpjDigits.length !== 14) {
          const fromBook = await fetchBookCnpjDigits(name, address);
          if (fromBook) cnpjDigits = fromBook;
        }
        if (cnpjDigits.length !== 14) {
          setError(
            `Linha ${li + 1}: CNPJ desta unidade em falta (inclua após Tab ou | no fim da linha, ou grave antes no repositório com nome + endereço iguais).`
          );
          setRunning(false);
          return;
        }
        built.push({ address, cnpjDigits });
      }
      units = built;
    } else {
      const addr = storeAddress.trim();
      if (!addr) {
        setError('Informe o endereço.');
        setRunning(false);
        return;
      }
      let cnpjDigits = digitsOnlyCnpjInput(storeCnpj);
      if (cnpjDigits.length !== 14) {
        const fromBook = await fetchBookCnpjDigits(name, addr);
        if (fromBook) cnpjDigits = fromBook;
      }
      units = [{ address: addr, cnpjDigits }];
    }

    try {
      for (let i = 0; i < units.length; i += 1) {
        const { address: addr, cnpjDigits } = units[i];
        setSteps(INITIAL_STEPS);
        const batchHint =
          units.length > 1
            ? `Unidade ${i + 1}/${units.length} — mesmos produtos, CNPJ desta loja (${addr.slice(0, 72)}${addr.length > 72 ? '…' : ''})`
            : undefined;

        const outcome = await runPipelineOnce(addr, products, batchHint, cnpjDigits);
        if (outcome !== 'done') {
          setRunning(false);
          return;
        }
        if (cnpjDigits.length === 14) {
          await saveBookRow(addr, cnpjDigits);
        }
      }
      setDone(true);
    } finally {
      setRunning(false);
    }
  }

  const fillFranchiseCnpjsFromBook = useCallback(async () => {
    const name = storeName.trim();
    if (name.length < 2) {
      setFranchiseBookFillMsg('Indique o nome da loja (igual ao usado ao gravar no repositório).');
      return;
    }
    const lines = franchiseUnitsRaw.split(/\n');
    if (!lines.some((l) => l.trim())) {
      setFranchiseBookFillMsg('Cole ou escreva pelo menos um endereço por linha.');
      return;
    }
    setFranchiseBookFillBusy(true);
    setFranchiseBookFillMsg('');
    let filled = 0;
    let already = 0;
    let missed = 0;
    const out: string[] = [];
    try {
      for (const line of lines) {
        if (!line.trim()) {
          out.push('');
          continue;
        }
        const parsed = parseFranchiseUnitLine(line);
        if (!parsed?.address) {
          out.push(line.trimEnd());
          continue;
        }
        const { address, cnpjDigits: existing } = parsed;
        if (existing.length === 14) {
          out.push(`${address}\t${formatCnpjFromDigits(existing)}`);
          already += 1;
          continue;
        }
        const fromBook = await fetchBookCnpjDigits(name, address);
        if (fromBook) {
          out.push(`${address}\t${formatCnpjFromDigits(fromBook)}`);
          filled += 1;
        } else {
          out.push(line.trim());
          missed += 1;
        }
      }
      const newRaw = out.join('\n');
      setFranchiseUnitsRaw((prev) => (prev === newRaw ? prev : newRaw));
      const parts: string[] = [];
      if (filled) parts.push(`${filled} completado(s) pelo repositório`);
      if (already) parts.push(`${already} já com CNPJ válido (linhas normalizadas)`);
      if (missed) parts.push(`${missed} sem correspondência — confira nome da loja e o texto do endereço`);
      setFranchiseBookFillMsg(parts.length ? parts.join(' · ') : 'Nada a alterar.');
    } catch {
      setFranchiseBookFillMsg('Erro ao consultar o repositório.');
    } finally {
      setFranchiseBookFillBusy(false);
    }
  }, [storeName, franchiseUnitsRaw]);

  const tryAutofillCnpjFromBook = useCallback(async () => {
    if (storeKind !== 'isolated') return;
    const d = digitsOnlyCnpjInput(storeCnpj);
    if (d.length >= 14) return;
    const a = storeAddress.trim();
    const n = storeName.trim();
    const fromBook = await fetchBookCnpjDigits(n, a);
    if (fromBook) setStoreCnpj(formatCnpjFromDigits(fromBook));
  }, [storeAddress, storeName, storeCnpj, storeKind]);

  useEffect(() => {
    let q = '';
    if (storeKind === 'franchise') {
      const firstLine = franchiseUnitsRaw.split(/\n/).find((l) => l.trim());
      const parsed = firstLine ? parseFranchiseUnitLine(firstLine) : null;
      const addrPart = parsed?.address?.trim() ?? '';
      q = addrPart.length >= 3 ? addrPart : storeName.trim();
    } else {
      q = (storeAddress.trim().length >= 3 ? storeAddress : storeName).trim();
    }
    if (q.length < 2) {
      setBookHints([]);
      return undefined;
    }
    const t = window.setTimeout(async () => {
      setBookLoading(true);
      try {
        const r = await fetch(`/api/admin/store-address-book?q=${encodeURIComponent(q.slice(0, 120))}`, {
          credentials: 'include',
        });
        const j = (await r.json()) as {
          items?: { store_name: string; address_raw: string; cnpj_digits: string; is_franchise: boolean }[];
        };
        if (r.ok && Array.isArray(j.items)) setBookHints(j.items);
        else setBookHints([]);
      } catch {
        setBookHints([]);
      } finally {
        setBookLoading(false);
      }
    }, 400);
    return () => window.clearTimeout(t);
  }, [storeAddress, storeName, storeKind, franchiseUnitsRaw]);

  function applyBookHint(row: (typeof bookHints)[number]) {
    setStoreName(row.store_name);
    if (row.is_franchise) {
      setStoreKind('franchise');
      setFranchiseUnitsRaw(`${row.address_raw}\t${row.cnpj_digits}`);
      setStoreAddress('');
      setStoreCnpj('');
    } else {
      setStoreKind('isolated');
      setStoreAddress(row.address_raw);
      setStoreCnpj(formatCnpjFromDigits(row.cnpj_digits));
      setFranchiseUnitsRaw('');
    }
  }

  function reset() {
    abortRef.current?.abort();
    setSteps(INITIAL_STEPS);
    setRunning(false);
    setDone(false);
    setError('');
    setProgress(0);
    setStoreKind('isolated');
    setFranchiseUnitsRaw('');
    setFranchiseBookFillMsg('');
    setFranchiseBookFillBusy(false);
    setBookHints([]);
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

  async function saveStoreLogoToRepository() {
    setCacheLogoMsg('');
    setCacheLogoBusy(true);
    try {
      const res = await fetch('/api/map/cache-store-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: cacheLogoStoreName.trim(),
          image_url: cacheLogoUrl.trim(),
        }),
        credentials: 'include',
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setCacheLogoMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      setCacheLogoMsg(
        'Gravado com proteção manual: o logo não é sobrescrito por fluxos automáticos; a URL inclui versão para evitar cache antigo no browser.'
      );
      setCacheLogoUrl('');
    } catch (e: unknown) {
      setCacheLogoMsg(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setCacheLogoBusy(false);
    }
  }

  async function clearStoreMapPromos() {
    setClearPromoMsg('');
    setClearPromoBusy(true);
    try {
      const res = await fetch('/api/admin/clear-store-map-promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_name: clearPromoStoreName.trim(),
          confirm: true,
        }),
        credentials: 'include',
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        matches?: { id: string; name: string }[];
        price_points_deleted?: number;
        promotions_deactivated?: number;
        promocoes_supermercados_deactivated?: number;
        matched_store_names?: string[];
      };
      if (res.status === 409 && j.matches?.length) {
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
        const parts = [
          `price_points apagados: ${j.price_points_deleted ?? 0}`,
          `promotions desativadas: ${j.promotions_deactivated ?? 0}`,
          `promocoes_supermercados desativadas: ${j.promocoes_supermercados_deactivated ?? 0}`,
        ];
        setClearPromoMsg(`Concluído. ${parts.join(' · ')}`);
        setClearPromoConfirm(false);
      } else {
        setClearPromoMsg(j.error || 'Resposta inesperada');
      }
    } catch (e: unknown) {
      setClearPromoMsg(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setClearPromoBusy(false);
    }
  }

  async function removeStoreFromMap() {
    setRemovePinMsg('');
    setRemovePinBusy(true);
    try {
      const scope = removePinScope === 'all' ? 'all_names' : 'address';
      const body: Record<string, unknown> = {
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

      const res = await fetch('/api/admin/remove-store-from-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const j = (await res.json()) as {
        ok?: boolean;
        error?: string;
        matches?: { id: string; name: string; address?: string }[];
        candidates?: { id: string; name: string; address?: string }[];
        deactivated_count?: number;
        promo_points_deleted?: number;
        map_pin_suppressions_inserted?: number;
        curated_pin_opt_out_upserted?: number;
        note?: string;
      };
      if (res.status === 409 && j.matches?.length) {
        setRemovePinMsg(
          `${j.error || 'Ambíguo.'} ${j.matches.map((m) => `${m.name} — ${m.address || '(sem endereço)'}`).join(' | ')}`
        );
        return;
      }
      if (res.status === 404 && j.candidates?.length) {
        setRemovePinMsg(
          `${j.error || 'Sem match.'} Cadastro(s) com este nome: ${j.candidates.map((c) => c.address || '(vazio)').join(' · ')}`
        );
        return;
      }
      if (!res.ok) {
        setRemovePinMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      if (j.ok) {
        const extra: string[] = [];
        if (typeof j.promo_points_deleted === 'number')
          extra.push(`price_points promo apagados: ${j.promo_points_deleted}`);
        if (typeof j.map_pin_suppressions_inserted === 'number')
          extra.push(`bloqueios de coordenada: ${j.map_pin_suppressions_inserted}`);
        if (typeof j.curated_pin_opt_out_upserted === 'number' && j.curated_pin_opt_out_upserted > 0)
          extra.push(`opt-out curadoria: ${j.curated_pin_opt_out_upserted} loja(s)`);
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
    } catch (e: unknown) {
      setRemovePinMsg(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setRemovePinBusy(false);
    }
  }

  async function submitCuratedOptOut(action: 'add' | 'remove') {
    setCuratedOptMsg('');
    setCuratedOptBusy(true);
    try {
      const res = await fetch('/api/admin/map-curated-opt-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          store_id: curatedOptStoreId.trim(),
          confirm: curatedOptConfirm,
          ...(action === 'add' && curatedOptNote.trim()
            ? { note: curatedOptNote.trim().slice(0, 500) }
            : {}),
        }),
        credentials: 'include',
      });
      const j = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setCuratedOptMsg(j.error || `HTTP ${res.status}`);
        return;
      }
      setCuratedOptMsg(action === 'add' ? 'Opt-out gravado. Pin Pomar/Sacolão só com ofertas.' : 'Opt-out removido.');
      setCuratedOptConfirm(false);
    } catch (e: unknown) {
      setCuratedOptMsg(e instanceof Error ? e.message : 'Erro de rede');
    } finally {
      setCuratedOptBusy(false);
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
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
          <Link href="/admin" className="text-emerald-400/90 underline-offset-2 hover:underline">
            ← Painel operacional
          </Link>
          <Link href="/admin/map-thumbnail-rules" className="text-emerald-400/90 underline-offset-2 hover:underline">
            Categorias de miniatura (base)
          </Link>
          <Link href="/admin/product-image-curator" className="text-emerald-400/90 underline-offset-2 hover:underline">
            Curador de imagens (3 sugestões Google)
          </Link>
        </p>
        <h1 className="text-2xl font-bold text-white mb-1">⚡ Quick Add</h1>
        <p className="text-gray-500 text-sm mb-4">
          Mapa de preços: lista manual grava preço + tenta miniatura (repositório/cache → categorias por palavra-chave → Open Food
          Facts → Google CSE com loja + produto). Fast food evita OFF em itens de cardápio; repositório com nome de categoria (ex.
          Arroz) cobre várias marcas. Uma vez gravada a
          foto do &quot;Filé mignon&quot; ou &quot;Manga Palmer&quot;, reutiliza em qualquer loja — sem reler o print.
        </p>

        <div className="mb-8 rounded-2xl border border-emerald-900/50 bg-emerald-950/15 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400/90">Repositório de miniaturas</h2>
          <p className="text-xs text-gray-400">
            Cole o URL https da foto real (ex. do teu print hospedado). O nome deve bater com o produto na lista ou com uma
            categoria curada (ex. <span className="text-gray-300">Arroz</span>, <span className="text-gray-300">Milk shake</span>
            ) para cobrir várias marcas com a mesma miniatura.
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

        <div className="mb-8 rounded-2xl border border-sky-900/50 bg-sky-950/15 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-sky-400/90">Repositório de logos de loja</h2>
          <p className="text-xs text-gray-400">
            Cole o URL https da imagem do logo. Use o mesmo nome (ou trecho forte) que aparece em{' '}
            <span className="text-gray-300">Nome da loja</span> no cadastro — ex.: &quot;Mercado XYZ&quot; casa com
            &quot;Mercado XYZ - Filial Centro&quot;.
          </p>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-600"
            value={cacheLogoStoreName}
            onChange={(e) => setCacheLogoStoreName(e.target.value)}
            placeholder="Nome da loja / rede (ex. Pomar da Vila Madalena)"
            disabled={cacheLogoBusy}
          />
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-sky-600"
            value={cacheLogoUrl}
            onChange={(e) => setCacheLogoUrl(e.target.value)}
            placeholder="https://… (logo jpg/png/webp)"
            disabled={cacheLogoBusy}
          />
          <button
            type="button"
            onClick={saveStoreLogoToRepository}
            disabled={cacheLogoBusy || !cacheLogoStoreName.trim() || !cacheLogoUrl.trim()}
            className="w-full bg-sky-700 hover:bg-sky-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold py-2 rounded uppercase tracking-wide"
          >
            {cacheLogoBusy ? 'A gravar…' : 'Gravar logo no repositório'}
          </button>
          {cacheLogoMsg ? (
            <p
              className={`text-xs ${cacheLogoMsg.startsWith('Gravado') ? 'text-sky-300' : 'text-red-400'}`}
            >
              {cacheLogoMsg}
            </p>
          ) : null}
        </div>

        <div className="mb-8 rounded-2xl border border-rose-900/60 bg-rose-950/20 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-rose-400/90">Limpar ofertas no mapa (por loja)</h2>
          <p className="text-xs text-gray-400">
            Apaga linhas <span className="text-gray-300">promocionais</span> em <code className="text-rose-200/80">price_points</code>,
            desativa <code className="text-rose-200/80">promotions</code> (encarte) e <code className="text-rose-200/80">promocoes_supermercados</code>{' '}
            quando o nome normalizado casa com o cadastro. Use o mesmo nome que em <span className="text-gray-300">Nome da loja</span>.
          </p>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-rose-600"
            value={clearPromoStoreName}
            onChange={(e) => setClearPromoStoreName(e.target.value)}
            placeholder="Nome exato da loja (ex. como em public.stores)"
            disabled={clearPromoBusy}
          />
          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-600"
              checked={clearPromoConfirm}
              onChange={(e) => setClearPromoConfirm(e.target.checked)}
              disabled={clearPromoBusy}
            />
            <span>Confirmo que quero remover as ofertas divulgadas desta loja no mapa (irreversível).</span>
          </label>
          <button
            type="button"
            onClick={clearStoreMapPromos}
            disabled={clearPromoBusy || !clearPromoStoreName.trim() || !clearPromoConfirm}
            className="w-full bg-rose-900 hover:bg-rose-800 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold py-2 rounded uppercase tracking-wide border border-rose-800/80"
          >
            {clearPromoBusy ? 'A processar…' : 'Remover ofertas desta loja'}
          </button>
          {clearPromoMsg ? (
            <p
              className={`text-xs whitespace-pre-wrap ${clearPromoMsg.startsWith('Concluído') ? 'text-rose-200' : 'text-red-400'}`}
            >
              {clearPromoMsg}
            </p>
          ) : null}
        </div>

        <div className="mb-8 rounded-2xl border border-amber-900/50 bg-amber-950/20 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-amber-400/90">
            Retirar loja do mapa (cadastro)
          </h2>
          <p className="text-xs text-gray-400">
            Desativa o pin em <code className="text-amber-200/80">public.stores</code> (<span className="text-gray-300">active = false</span>
            ). Para duplicata: use o <span className="text-gray-300">mesmo nome</span> e cole o{' '}
            <span className="text-gray-300">endereço errado</span> da linha a remover; a loja correta permanece. Marque as opções
            abaixo para também apagar ofertas em <code className="text-amber-200/80">price_points</code> e bloquear o pin no mesmo
            local (evita reaparecer por importação/CNPJ após aplicar a migração <code className="text-gray-500">map_pin_location_suppressions</code>).
          </p>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
            value={removePinStoreName}
            onChange={(e) => setRemovePinStoreName(e.target.value)}
            placeholder="Nome da loja (como no cadastro)"
            disabled={removePinBusy}
          />
          <div className="flex flex-col gap-2 text-xs text-gray-300">
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="removePinScope"
                className="mt-0.5"
                checked={removePinScope === 'address'}
                onChange={() => setRemovePinScope('address')}
                disabled={removePinBusy}
              />
              <span>
                <strong className="text-amber-200/90">Só esta filial</strong> — exige o endereço da loja a desativar
                (duplicatas).
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="radio"
                name="removePinScope"
                className="mt-0.5"
                checked={removePinScope === 'all'}
                onChange={() => setRemovePinScope('all')}
                disabled={removePinBusy}
              />
              <span>
                <strong className="text-amber-200/90">Todas as lojas ativas</strong> com este nome (vários pins de uma vez).
              </span>
            </label>
          </div>
          {removePinScope === 'address' ? (
            <input
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-600"
              value={removePinAddress}
              onChange={(e) => setRemovePinAddress(e.target.value)}
              placeholder="Endereço exatamente como no cadastro errado (rua, nº, bairro…)"
              disabled={removePinBusy}
            />
          ) : null}
          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-600"
              checked={removePinClearPromoPoints}
              onChange={(e) => setRemovePinClearPromoPoints(e.target.checked)}
              disabled={removePinBusy}
            />
            <span>
              Também apagar <strong className="text-amber-200/80">ofertas em price_points</strong> (categoria promocional) com o
              nome exato desta(s) loja(s).
            </span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-600"
              checked={removePinBlacklistCoords}
              onChange={(e) => {
                setRemovePinBlacklistCoords(e.target.checked);
                if (!e.target.checked) setRemovePinConfirmBlacklist(false);
              }}
              disabled={removePinBusy}
            />
            <span>
              <strong className="text-amber-200/80">Bloquear esta coordenada</strong> — o mapa deixa de mostrar o pin aqui e o{' '}
              <code className="text-gray-500">find_or_create_store</code> não reativa/inserir neste sítio (mesmo nome
              normalizado).
            </span>
          </label>
          {removePinBlacklistCoords ? (
            <label className="flex items-start gap-2 text-xs text-amber-200/90 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-amber-700"
                checked={removePinConfirmBlacklist}
                onChange={(e) => setRemovePinConfirmBlacklist(e.target.checked)}
                disabled={removePinBusy}
              />
              <span>Confirmo gravar o bloqueio de coordenada (reversível apagando a linha em map_pin_location_suppressions).</span>
            </label>
          ) : null}
          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-600"
              checked={removePinCuratedOptOut}
              onChange={(e) => {
                setRemovePinCuratedOptOut(e.target.checked);
                if (!e.target.checked) setRemovePinConfirmCuratedOptOut(false);
              }}
              disabled={removePinBusy}
            />
            <span>
              <strong className="text-amber-200/80">Opt-out curadoria</strong> — gravar em{' '}
              <code className="text-gray-500">map_curated_pin_opt_out</code>: esta loja deixa de usar o bypass Pomar/Sacolão
              (só aparece no mapa com ofertas, útil se for reactivada mais tarde).
            </span>
          </label>
          {removePinCuratedOptOut ? (
            <label className="flex items-start gap-2 text-xs text-amber-200/90 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-amber-700"
                checked={removePinConfirmCuratedOptOut}
                onChange={(e) => setRemovePinConfirmCuratedOptOut(e.target.checked)}
                disabled={removePinBusy}
              />
              <span>Confirmo gravar o opt-out de curadoria para o(s) store_id desativado(s).</span>
            </label>
          ) : null}
          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-600"
              checked={removePinConfirm}
              onChange={(e) => setRemovePinConfirm(e.target.checked)}
              disabled={removePinBusy}
            />
            <span>Confirmo desativar o(s) pin(s) desta(s) loja(s) no mapa.</span>
          </label>
          {removePinScope === 'all' ? (
            <label className="flex items-start gap-2 text-xs text-amber-200/90 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-amber-700"
                checked={removePinConfirmAllNames}
                onChange={(e) => setRemovePinConfirmAllNames(e.target.checked)}
                disabled={removePinBusy}
              />
              <span>Entendo que TODAS as lojas ativas com este nome serão desativadas.</span>
            </label>
          ) : null}
          <button
            type="button"
            onClick={removeStoreFromMap}
            disabled={
              removePinBusy ||
              !removePinStoreName.trim() ||
              !removePinConfirm ||
              (removePinScope === 'address' && !removePinAddress.trim()) ||
              (removePinScope === 'all' && !removePinConfirmAllNames) ||
              (removePinBlacklistCoords && !removePinConfirmBlacklist) ||
              (removePinCuratedOptOut && !removePinConfirmCuratedOptOut)
            }
            className="w-full bg-amber-900 hover:bg-amber-800 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold py-2 rounded uppercase tracking-wide border border-amber-800/80"
          >
            {removePinBusy ? 'A processar…' : 'Desativar loja(s) no mapa'}
          </button>
          {removePinMsg ? (
            <p
              className={`text-xs whitespace-pre-wrap ${removePinMsg.startsWith('Concluído') ? 'text-amber-200' : 'text-red-400'}`}
            >
              {removePinMsg}
            </p>
          ) : null}
        </div>

        <div className="mb-8 rounded-2xl border border-teal-900/50 bg-teal-950/20 p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-400/90">
            Curadoria Pomar / Sacolão (loja ainda activa)
          </h2>
          <p className="text-xs text-gray-400">
            Use o <code className="text-teal-200/80">id</code> da linha em <code className="text-teal-200/80">public.stores</code>{' '}
            (Supabase). Com opt-out, o pin <strong className="text-gray-300">só</strong> entra no mapa se tiver ofertas — como
            qualquer outro supermercado.
          </p>
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-600"
            value={curatedOptStoreId}
            onChange={(e) => setCuratedOptStoreId(e.target.value)}
            placeholder="UUID da loja (stores.id)"
            disabled={curatedOptBusy}
          />
          <input
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-teal-600"
            value={curatedOptNote}
            onChange={(e) => setCuratedOptNote(e.target.value)}
            placeholder="Nota opcional (só ao gravar opt-out)"
            disabled={curatedOptBusy}
          />
          <label className="flex items-start gap-2 text-xs text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-600"
              checked={curatedOptConfirm}
              onChange={(e) => setCuratedOptConfirm(e.target.checked)}
              disabled={curatedOptBusy}
            />
            <span>Confirmo a alteração neste UUID.</span>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => submitCuratedOptOut('add')}
              disabled={curatedOptBusy || !curatedOptStoreId.trim() || !curatedOptConfirm}
              className="flex-1 min-w-[8rem] bg-teal-900 hover:bg-teal-800 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold py-2 rounded uppercase tracking-wide border border-teal-800/80"
            >
              {curatedOptBusy ? '…' : 'Gravar opt-out'}
            </button>
            <button
              type="button"
              onClick={() => submitCuratedOptOut('remove')}
              disabled={curatedOptBusy || !curatedOptStoreId.trim() || !curatedOptConfirm}
              className="flex-1 min-w-[8rem] bg-gray-800 hover:bg-gray-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-bold py-2 rounded uppercase tracking-wide border border-gray-600"
            >
              {curatedOptBusy ? '…' : 'Remover opt-out'}
            </button>
          </div>
          {curatedOptMsg ? (
            <p
              className={`text-xs whitespace-pre-wrap ${
                curatedOptMsg.includes('gravado') || curatedOptMsg.includes('removido')
                  ? 'text-teal-200'
                  : 'text-red-400'
              }`}
            >
              {curatedOptMsg}
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
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Tipo de cadastro</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
                  <input
                    type="radio"
                    name="store-kind"
                    checked={storeKind === 'isolated'}
                    onChange={() => setStoreKind('isolated')}
                    className="accent-blue-500"
                  />
                  Loja isolada (um endereço)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
                  <input
                    type="radio"
                    name="store-kind"
                    checked={storeKind === 'franchise'}
                    onChange={() => setStoreKind('franchise')}
                    className="accent-blue-500"
                  />
                  Franquia (rede — várias unidades, mesmo encarte)
                </label>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                Em franquia (ex.: supermercado do dia), cada filial costuma ter{' '}
                <span className="text-gray-400">CNPJ diferente</span>: indique um por linha. O mesmo catálogo de
                produtos é publicado em todas. Se já gravou nome + endereço + CNPJ antes, pode deixar só o endereço na
                linha e o sistema completa o CNPJ a partir do repositório ao executar.
              </p>
            </div>
            {storeKind === 'isolated' ? (
              <>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">Endereço *</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={storeAddress}
                    onChange={(e) => setStoreAddress(e.target.value)}
                    onBlur={() => void tryAutofillCnpjFromBook()}
                    placeholder="Ex: Rua Harmonia, 123, Vila Madalena, SP"
                  />
                  {bookLoading ? (
                    <p className="mt-1 text-[11px] text-gray-500">A carregar sugestões do repositório…</p>
                  ) : null}
                  {bookHints.length > 0 ? (
                    <div className="mt-2 rounded border border-gray-700 bg-gray-950/50 p-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Sugestões (repositório)</p>
                      <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                        {bookHints.map((row) => (
                          <li key={`${row.cnpj_digits}-${row.address_raw}`}>
                            <button
                              type="button"
                              onClick={() => applyBookHint(row)}
                              className="w-full rounded px-2 py-1.5 text-left text-gray-200 hover:bg-gray-800"
                            >
                              <span className="font-medium text-gray-100">{row.store_name}</span>
                              <span className="block text-[11px] text-gray-400">{row.address_raw}</span>
                              <span className="text-[10px] text-gray-500">
                                CNPJ {formatCnpjFromDigits(row.cnpj_digits)}
                                {row.is_franchise ? ' · franquia' : ''}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">CNPJ (opcional)</label>
                  <input
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    value={storeCnpj}
                    onChange={(e) => setStoreCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00"
                  />
                  <p className="mt-1 text-[11px] text-gray-500">
                    Com 14 dígitos, gravamos no repositório após publicação (para autocompletar na próxima vez com o
                    mesmo nome e endereço).
                  </p>
                </div>
              </>
            ) : (
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-widest block mb-1">
                  Unidades da rede * (uma por linha)
                </label>
                <textarea
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 h-40 resize-y font-mono text-[13px]"
                  value={franchiseUnitsRaw}
                  onChange={(e) => {
                    setFranchiseUnitsRaw(e.target.value);
                    setFranchiseBookFillMsg('');
                  }}
                  placeholder={
                    'Cada linha: endereço completo, depois Tab ou | e o CNPJ daquela filial.\n' +
                    'Ex.:\n' +
                    'Av. Paulista, 1000, SP\t12.345.678/0001-90\n' +
                    'Rua das Flores, 50, Campinas | 98.765.432/0001-10\n\n' +
                    'Se o CNPJ já estiver gravado para esse nome + endereço, pode colar só o endereço na linha.'
                  }
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Ordem de publicação: linha 1, depois 2… Mesmos produtos em todas; CNPJ e geocoding por unidade.
                </p>
                <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
                  <button
                    type="button"
                    disabled={
                      running || franchiseBookFillBusy || !storeName.trim() || !franchiseUnitsRaw.trim()
                    }
                    onClick={() => void fillFranchiseCnpjsFromBook()}
                    className="w-full rounded border border-amber-700/80 bg-amber-950/40 px-3 py-2 text-left text-xs font-medium text-amber-100 hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto"
                  >
                    {franchiseBookFillBusy ? 'A consultar o repositório…' : 'Completar CNPJs do repositório'}
                  </button>
                  {franchiseBookFillMsg ? (
                    <p className="text-[11px] leading-snug text-gray-400 sm:max-w-xl">{franchiseBookFillMsg}</p>
                  ) : null}
                </div>
                {bookLoading ? (
                  <p className="mt-1 text-[11px] text-gray-500">A carregar sugestões do repositório…</p>
                ) : null}
                {bookHints.length > 0 ? (
                  <div className="mt-2 rounded border border-gray-700 bg-gray-950/50 p-2">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Sugestões (repositório)</p>
                    <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
                      {bookHints.map((row) => (
                        <li key={`${row.cnpj_digits}-${row.address_raw}`}>
                          <button
                            type="button"
                            onClick={() => applyBookHint(row)}
                            className="w-full rounded px-2 py-1.5 text-left text-gray-200 hover:bg-gray-800"
                          >
                            <span className="font-medium text-gray-100">{row.store_name}</span>
                            <span className="block text-[11px] text-gray-400">{row.address_raw}</span>
                            <span className="text-[10px] text-gray-500">
                              CNPJ {formatCnpjFromDigits(row.cnpj_digits)}
                              {row.is_franchise ? ' · franquia' : ''}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            )}
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
              disabled={
                !storeName.trim() ||
                !productsRaw.trim() ||
                (storeKind === 'isolated' ? !storeAddress.trim() : !franchiseUnitsRaw.trim())
              }
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
