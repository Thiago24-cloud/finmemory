import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { getServerSession } from 'next-auth/next';
import {
  ArrowLeft,
  Copy,
  ExternalLink,
  Loader2,
  Map,
  MessageCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { authOptions } from './api/auth/[...nextauth]';
import { canAccessForSession } from '../lib/access-server';
import { isFinmemoryAdminEmail } from '../lib/adminAccess';

const inputClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductThumb({ url, name }) {
  if (!url) {
    return (
      <div className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
        {(name || '?').slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name || ''}
      className="h-9 w-9 shrink-0 rounded-lg object-cover bg-muted border border-border"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

function StoreLogo({ url, name }) {
  if (!url) {
    return (
      <div className="h-10 w-10 shrink-0 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-xs font-black border border-orange-200">
        {(name || 'M').slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name || 'logo'}
      className="h-10 w-10 shrink-0 rounded-full object-contain bg-white border border-border p-1"
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}

export async function getServerSideProps(ctx) {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
  if (!canAccessForSession(session)) {
    return { redirect: { destination: '/login?callbackUrl=/orcamento', permanent: false } };
  }
  return {
    props: {
      isAdmin: Boolean(session?.user?.email && isFinmemoryAdminEmail(session.user.email)),
    },
  };
}

/**
 * B2C — comparar lista na região e enviar/compartilhar no WhatsApp.
 */
export default function OrcamentoPage({ isAdmin }) {
  const router = useRouter();
  const [paste, setPaste] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [radiusKm, setRadiusKm] = useState(8);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!router.isReady) return;
    const lista = String(router.query.lista || '').trim();
    if (lista) {
      setItemsText(
        decodeURIComponent(lista)
          .split(/[,;]+/)
          .map((s) => s.trim())
          .filter(Boolean)
          .join('\n')
      );
    }
  }, [router.isReady, router.query.lista]);

  const loadDemo = async () => {
    setSeeding(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/map/whatsapp-quote-seed', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao carregar demo.');
        return;
      }
      if (data.sample_paste) {
        setPaste(data.sample_paste);
        setAddress('Rua Fradique Coutinho 914, Vila Madalena, São Paulo - SP');
        setPhone('11987654321');
        setItemsText(['Arroz', 'Feijão', 'Batata frita', 'Óleo', 'Leite'].join('\n'));
      }
      setSuccess(`Demo SP: ${data.inserted || 0} ofertas. Clique em Comparar preços.`);
    } catch {
      setError('Erro de rede.');
    } finally {
      setSeeding(false);
    }
  };

  const runQuote = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const items = itemsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((n) => n.length >= 2);

      const res = await fetch('/api/map/whatsapp-quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: paste,
          address: address || undefined,
          phone: phone || undefined,
          customer_name: customerName || undefined,
          items: items.length ? items : undefined,
          radius_km: radiusKm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Falha ao comparar preços.');
        setResult(null);
        return;
      }
      setResult(data);
      if (data.parsed?.address && !address) setAddress(data.parsed.address);
      if (data.parsed?.phone_digits && !phone) setPhone(data.parsed.phone_digits);
      if (data.parsed?.items?.length && !itemsText.trim()) {
        setItemsText(data.parsed.items.join('\n'));
      }
      setSuccess(
        data.geo?.geocoded
          ? `${data.stores?.length || 0} mercados na sua região.`
          : 'Comparação pronta (sem geocode do endereço).'
      );
    } catch {
      setError('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const copyMsg = async () => {
    if (!result?.mensagem) return;
    try {
      await navigator.clipboard.writeText(result.mensagem);
      setSuccess('Mensagem copiada.');
    } catch {
      setError('Não foi possível copiar.');
    }
  };

  return (
    <>
      <Head>
        <title>Orçamento WhatsApp · FinMemory</title>
      </Head>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
          <Link href="/dashboard" className="p-2 rounded-xl hover:bg-muted" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold m-0 truncate">Orçamento WhatsApp</h1>
            <p className="text-[11px] text-muted-foreground m-0">
              Lista + região → preços no mapa → enviar no WhatsApp
            </p>
          </div>
          {result?.mapa_lista_url ? (
            <Link
              href={result.mapa_lista_url}
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
            >
              <Map className="h-3.5 w-3.5" />
              Mapa
            </Link>
          ) : null}
        </header>

        <main className="max-w-lg mx-auto px-4 py-4 space-y-4 pb-24">
          {error ? (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2 m-0">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 m-0">
              {success}
            </p>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="text-sm text-muted-foreground m-0">
                Digite sua lista (ou cole do WhatsApp). Comparamos nos mercados da sua região — o
                mesmo Caça-Preço do mapa.
              </p>
              {isAdmin ? (
                <button
                  type="button"
                  disabled={seeding || busy}
                  onClick={() => void loadDemo()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {seeding ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Demo SP
                </button>
              ) : null}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">Colar mensagem (opcional)</span>
              <textarea
                className={`${inputClass} min-h-[100px] font-mono text-xs`}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={`Rua …, bairro, SP\n11 9…\nArroz\nFeijão\nBatata frita`}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1 col-span-2 sm:col-span-1">
                <span className="text-xs font-semibold">Seu nome (opcional)</span>
                <input
                  className={inputClass}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Você"
                />
              </label>
              <label className="block space-y-1 col-span-2 sm:col-span-1">
                <span className="text-xs font-semibold">WhatsApp destino</span>
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="11999999999"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">Endereço / bairro</span>
              <input
                className={inputClass}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Vila Madalena, São Paulo"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs font-semibold">Lista de produtos</span>
              <textarea
                className={`${inputClass} min-h-[100px]`}
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                placeholder={'Arroz\nFeijão\nBatata frita'}
              />
            </label>

            {result?.items_detail?.length ? (
              <div className="flex flex-wrap gap-2">
                {result.items_detail.map((it) => (
                  <div
                    key={it.listName || it.listItemId}
                    className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5"
                  >
                    <ProductThumb url={it.image_url} name={it.listName} />
                    <span className="text-xs font-medium max-w-[120px] truncate">{it.listName}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <label className="flex items-center gap-2 text-xs">
              Raio (km)
              <input
                type="number"
                min={2}
                max={25}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value) || 8)}
                className="w-16 rounded-lg border border-border px-2 py-1"
              />
            </label>

            <button
              type="button"
              disabled={busy || (!paste.trim() && !itemsText.trim())}
              onClick={() => void runQuote()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Comparar preços
            </button>
          </div>

          {result ? (
            <div className="space-y-4">
              {result.used_fallback_national ? (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 m-0">
                  Poucos mercados no raio — mostrei preços gerais do mapa.
                </p>
              ) : null}

              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <p className="text-sm font-bold m-0">Mercados perto de você</p>
                {(result.stores || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground m-0">Nenhum match ainda.</p>
                ) : (
                  <ul className="space-y-3 list-none p-0 m-0">
                    {result.stores.map((s) => (
                      <li key={s.storeId || s.storeName} className="rounded-xl border border-border p-3">
                        <div className="flex justify-between gap-2 items-start">
                          <div className="flex items-center gap-2 min-w-0">
                            <StoreLogo url={s.logo_url} name={s.storeName} />
                            <div className="min-w-0">
                              <span className="font-bold text-sm block truncate">{s.storeName}</span>
                              <p className="text-[11px] text-muted-foreground m-0">
                                {s.coveredItems}/{s.totalItems} itens · {s.coveragePct}%
                              </p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-primary shrink-0">
                            {brl(s.total)}
                          </span>
                        </div>
                        <ul className="mt-2 space-y-1.5 list-none p-0 m-0 text-xs">
                          {(s.lines || []).slice(0, 10).map((l) => (
                            <li key={l.listName} className="flex justify-between gap-2 items-center">
                              <span className="flex items-center gap-2 min-w-0">
                                <ProductThumb url={l.image_url} name={l.listName} />
                                <span className="truncate">{l.listName}</span>
                              </span>
                              <span className="shrink-0 font-medium">{brl(l.price)}</span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                <p className="text-sm font-bold m-0">Mensagem</p>
                <pre className="whitespace-pre-wrap text-xs bg-muted/40 rounded-xl p-3 m-0 max-h-64 overflow-y-auto">
                  {result.mensagem}
                </pre>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void copyMsg()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copiar
                  </button>
                  {result.whatsapp_url ? (
                    <a
                      href={result.whatsapp_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3 py-2 text-xs font-bold text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Enviar no WhatsApp
                      <ExternalLink className="h-3 w-3 opacity-80" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </>
  );
}
