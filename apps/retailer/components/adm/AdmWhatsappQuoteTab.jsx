'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Loader2, MessageCircle, Search, Sparkles } from 'lucide-react';

const inputClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/30';

function brl(n) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function ProductThumb({ url, name }) {
  if (!url) {
    return (
      <div
        className="h-9 w-9 shrink-0 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground"
        title={name}
      >
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

/**
 * Cola mensagem WhatsApp (endereço + lista) → preços do mapa → enviar resposta.
 */
export function AdmWhatsappQuoteTab({ onError, onSuccess }) {
  const [paste, setPaste] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [itemsText, setItemsText] = useState('');
  const [radiusKm, setRadiusKm] = useState(8);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState(null);

  const loadDemo = async () => {
    setSeeding(true);
    onError?.('');
    onSuccess?.('');
    try {
      const res = await fetch('/api/parceiros/adm/whatsapp-quote-seed', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        onError?.(data.error || 'Falha ao carregar demo SP.');
        return;
      }
      if (data.sample_paste) {
        setPaste(data.sample_paste);
        setAddress('Rua Fradique Coutinho 914, Vila Madalena, São Paulo - SP');
        setPhone('11987654321');
        setItemsText(['Arroz', 'Feijão', 'Batata frita', 'Óleo', 'Leite'].join('\n'));
      }
      onSuccess?.(
        `Demo SP carregada: ${data.inserted || 0} ofertas em ${data.stores?.length || 0} mercados. Agora clique em Buscar preços.`
      );
    } catch {
      onError?.('Erro de rede ao carregar demo.');
    } finally {
      setSeeding(false);
    }
  };

  const runQuote = async () => {
    setBusy(true);
    onError?.('');
    onSuccess?.('');
    try {
      const items = itemsText
        .split(/[,;\n]+/)
        .map((s) => s.trim())
        .filter((n) => n.length >= 2);

      const res = await fetch('/api/parceiros/adm/whatsapp-quote', {
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
        onError?.(data.error || 'Falha ao montar orçamento.');
        setResult(null);
        return;
      }
      setResult(data);
      if (data.parsed?.address && !address) setAddress(data.parsed.address);
      if (data.parsed?.phone_digits && !phone) setPhone(data.parsed.phone_digits);
      if (data.parsed?.items?.length && !itemsText.trim()) {
        setItemsText(data.parsed.items.join('\n'));
      }
      onSuccess?.(
        data.geo?.geocoded
          ? `Orçamento pronto · ${data.stores?.length || 0} mercados no raio.`
          : `Orçamento pronto · endereço sem geocode (busquei preços gerais).`
      );
    } catch {
      onError?.('Erro de rede.');
    } finally {
      setBusy(false);
    }
  };

  const copyMsg = async () => {
    if (!result?.mensagem) return;
    try {
      await navigator.clipboard.writeText(result.mensagem);
      onSuccess?.('Mensagem copiada.');
    } catch {
      onError?.('Não foi possível copiar.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold m-0">Orçamento via WhatsApp</p>
            <p className="text-xs text-muted-foreground m-0 mt-1">
              Cole a mensagem do cliente (endereço + lista). O sistema cruza com o mapa de preços da
              região, mostra logos dos mercados e fotos dos produtos (cache OFF/Cosmos), e monta a
              resposta para enviar no WhatsApp.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding || busy}
            onClick={() => void loadDemo()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold disabled:opacity-50"
          >
            {seeding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Carregar demo SP
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold">Colar mensagem do WhatsApp</span>
          <textarea
            className={`${inputClass} min-h-[120px] font-mono text-xs`}
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder={`Exemplo:\nRua das Flores 123, Vila Madalena, SP\n11 98888-7777\nArroz 5kg\nFeijão carioca\nBatata frita\nÓleo de soja`}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-xs font-semibold">Nome (opcional)</span>
            <input
              className={inputClass}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Maria"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-semibold">WhatsApp (com DDD)</span>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11999999999"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-xs font-semibold">Endereço / região</span>
          <input
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Rua, bairro, cidade"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-semibold">Lista de produtos (1 por linha)</span>
          <textarea
            className={`${inputClass} min-h-[100px]`}
            value={itemsText}
            onChange={(e) => setItemsText(e.target.value)}
            placeholder="Arroz&#10;Feijão&#10;Batata frita"
          />
        </label>

        {itemsText.trim() || result?.items_detail?.length ? (
          <div className="flex flex-wrap gap-2">
            {(result?.items_detail?.length
              ? result.items_detail
              : itemsText
                  .split(/[,;\n]+/)
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((listName) => ({ listName, image_url: null }))
            ).map((it) => (
              <div
                key={it.listName || it.listItemId}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-2 py-1.5"
              >
                <ProductThumb url={it.image_url} name={it.listName} />
                <span className="text-xs font-medium max-w-[140px] truncate">{it.listName}</span>
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
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Buscar preços no mapa
        </button>
      </div>

      {result ? (
        <div className="space-y-4">
          {result.used_fallback_national ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 m-0">
              Nenhum mercado no raio — mostrei preços gerais do mapa.
            </p>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
            <p className="text-sm font-bold m-0">Mercados (melhor cobertura / preço)</p>
            {(result.stores || []).length === 0 ? (
              <p className="text-sm text-muted-foreground m-0">Nenhum mercado com match.</p>
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
                      <span className="text-sm font-semibold text-primary shrink-0">{brl(s.total)}</span>
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
            <p className="text-sm font-bold m-0">Mensagem para o cliente</p>
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
                  Abrir WhatsApp
                  <ExternalLink className="h-3 w-3 opacity-80" />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground m-0 self-center">
                  Informe o WhatsApp do cliente para abrir o envio.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
