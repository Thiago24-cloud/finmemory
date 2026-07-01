'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  DollarSign,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Terminal,
  TrendingUp,
} from 'lucide-react';
import { painelApi } from '../../lib/merchant/painelApiPaths';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const terminalClass = {
  stone: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  cielo: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  pagseguro: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  mercadopago: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  rede: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  other: 'bg-white/10 text-white/60 border-white/15',
};

const metodoClass = {
  credito: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  debito: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  pix: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
  dinheiro: 'bg-green-500/15 text-green-300 border-green-500/30',
};

const statusClass = {
  aprovado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejeitado: 'bg-red-500/15 text-red-300 border-red-500/30',
  cancelado: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
};

function Badge({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${className}`}
    >
      {children}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/50 hover:bg-white/5"
      aria-label="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-[#39FF14]" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function VendaRow({ venda }) {
  const [open, setOpen] = useState(false);
  const ref = venda.externalRef || venda.external_ref;
  const isSim = ref?.startsWith('SIM_');

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-white/90">#{String(venda.id).slice(0, 8)}</span>
            <Badge className={terminalClass[venda.terminal] || terminalClass.other}>{venda.terminal}</Badge>
            {venda.bandeira ? (
              <Badge className="bg-white/10 text-white/50 border-white/15">{venda.bandeira}</Badge>
            ) : null}
            <Badge className={metodoClass[venda.metodo] || ''}>{venda.metodo}</Badge>
            <Badge className={statusClass[venda.status] || ''}>{venda.status}</Badge>
            {isSim ? (
              <Badge className="bg-yellow-500/15 text-yellow-300 border-yellow-500/30">simulado</Badge>
            ) : null}
          </div>
          <p className="text-xs text-white/45 mt-1 m-0">
            {venda.createdAt
              ? new Date(venda.createdAt).toLocaleString('pt-BR')
              : '—'}
            {ref && !isSim ? (
              <>
                {' '}
                · <span className="font-mono text-[10px]">{ref}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-sm">{formatBrl(venda.valorTotal || venda.valor_total)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-white/40" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-white/40" aria-hidden />
          )}
        </div>
      </button>
      {open && venda.items?.length > 0 ? (
        <div className="px-4 pb-3 pt-0 border-t border-white/10">
          <p className="text-xs font-medium text-white/45 mt-3 mb-2">Itens da venda</p>
          <ul className="space-y-1.5 list-none p-0 m-0">
            {venda.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm text-white/80">
                <span>
                  {item.quantidade}× {item.nomeProduto || item.nome_produto}
                </span>
                <span className="text-white/45">{formatBrl(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm font-semibold border-t border-white/10 pt-2 mt-2 text-white/90">
            <span>Total</span>
            <span>{formatBrl(venda.valorTotal || venda.valor_total)}</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MerchantVendasSection({ lojaId }) {
  const [vendas, setVendas] = useState([]);
  const [resumo, setResumo] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [vRes, rRes, sRes] = await Promise.all([
        fetch(painelApi.vendas),
        fetch(painelApi.vendasResumo),
        fetch(painelApi.paymentsStatus),
      ]);
      const [vData, rData, sData] = await Promise.all([
        vRes.json().catch(() => []),
        rRes.json().catch(() => ({})),
        sRes.json().catch(() => ({})),
      ]);
      if (!vRes.ok) {
        setError(vData.error || 'Não foi possível carregar vendas.');
        setVendas([]);
      } else {
        setVendas(Array.isArray(vData) ? vData : []);
      }
      if (rRes.ok) setResumo(rData);
      if (sRes.ok) setStatus(sData);
    } catch {
      setError('Erro de rede ao carregar vendas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(t);
  }, [load]);

  async function sendTestWebhook() {
    setTestLoading(true);
    setTestResult(null);
    try {
      const prodRes = await fetch(painelApi.products);
      const produtos = await prodRes.json().catch(() => []);
      if (!Array.isArray(produtos) || produtos.length === 0) {
        setTestResult({
          ok: false,
          msg: 'Cadastre pelo menos um produto em Ofertas antes de simular.',
        });
        return;
      }
      const primeiro = produtos[0];
      const preco = Number(primeiro.preco_oferta ?? primeiro.price ?? 10);
      const res = await fetch(painelApi.paymentsSimulate, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          terminal: 'stone',
          bandeira: 'visa',
          valor_total: preco,
          metodo: 'credito',
          items: [
            {
              produto_loja_id: primeiro.id,
              quantidade: 1,
              preco_unitario: preco,
            },
          ],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setTestResult({
          ok: true,
          msg: `Venda simulada (#${String(data.venda_id).slice(0, 8)}). Estoque de "${primeiro.nome || primeiro.name}" debitado.`,
        });
        void load();
      } else {
        setTestResult({ ok: false, msg: data.error || 'Falha na simulação.' });
      }
    } catch {
      setTestResult({ ok: false, msg: 'Erro ao conectar com a API.' });
    } finally {
      setTestLoading(false);
    }
  }

  const webhookUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${painelApi.paymentsWebhook}`
      : painelApi.paymentsWebhook;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold m-0 text-white/95">Vendas</h2>
        <p className="text-sm text-white/45 mt-1 m-0">
          Histórico de pagamentos recebidos pelas maquininhas e pelo app Android.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/50 m-0 font-medium">Receita (24h)</p>
            <DollarSign className="h-4 w-4 text-white/35" aria-hidden />
          </div>
          <p className="text-2xl font-bold m-0">{resumo ? formatBrl(resumo.receita_hoje) : '—'}</p>
          <p className="text-xs text-white/40 mt-1 m-0">{resumo?.vendas_hoje ?? 0} vendas aprovadas</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/50 m-0 font-medium">Receita total</p>
            <TrendingUp className="h-4 w-4 text-white/35" aria-hidden />
          </div>
          <p className="text-2xl font-bold m-0">{resumo ? formatBrl(resumo.receita_total) : '—'}</p>
          <p className="text-xs text-white/40 mt-1 m-0">{resumo?.total_vendas ?? 0} vendas registradas</p>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            status?.key_configured ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-white/50 m-0 font-medium">Segurança webhook</p>
            {status?.key_configured ? (
              <ShieldCheck className="h-4 w-4 text-emerald-400" aria-hidden />
            ) : (
              <ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden />
            )}
          </div>
          {status?.key_configured ? (
            <>
              <p className="text-sm font-semibold text-emerald-300 m-0">API Key ativa</p>
              <p className="text-xs text-white/40 font-mono mt-1 m-0">{status.key_prefix}</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-amber-300 m-0">Sem autenticação</p>
              <p className="text-xs text-white/40 mt-1 m-0">Configure WEBHOOK_API_KEY no servidor</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="h-4 w-4 text-white/35" aria-hidden />
            <p className="text-xs text-white/50 m-0 font-medium">Simular pagamento</p>
          </div>
          <p className="text-xs text-white/40 m-0">Testa o pipeline sem maquininha real.</p>
          <button
            type="button"
            onClick={() => void sendTestWebhook()}
            disabled={testLoading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#39FF14] px-3 py-2 text-xs font-bold text-[#050508] disabled:opacity-50"
          >
            {testLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
            Simular
          </button>
          {testResult ? (
            <p className={`text-xs mt-2 m-0 ${testResult.ok ? 'text-[#39FF14]' : 'text-red-400'}`}>
              {testResult.msg}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold m-0 mb-3 flex items-center gap-2 text-white/90">
          <ShoppingCart className="h-4 w-4" aria-hidden />
          Últimas vendas
        </h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-[#39FF14]" aria-label="Carregando" />
          </div>
        ) : vendas.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center gap-3 rounded-xl border border-dashed border-white/15">
            <Clock className="h-10 w-10 text-white/20" aria-hidden />
            <p className="text-sm text-white/45 m-0 max-w-sm">
              Nenhuma venda registrada ainda. As vendas aparecem aqui quando a maquininha ou o app Android
              confirmar o pagamento.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {vendas.map((v) => (
              <VendaRow key={v.id} venda={v} />
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4 space-y-4">
        <p className="text-sm font-semibold text-white/80 m-0">Integração maquininha / Android</p>
        {lojaId ? (
          <p className="text-xs text-white/40 m-0">
            Loja: <span className="font-mono text-white/60">{lojaId}</span> — inclua{' '}
            <code className="text-[#39FF14]">loja_id</code> no payload do webhook.
          </p>
        ) : null}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/40 m-0 mb-1">Endpoint</p>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
            <code className="text-xs flex-1 truncate text-white/70">{webhookUrl}</code>
            <CopyButton text={webhookUrl} />
          </div>
        </div>
        {status?.key_configured ? (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/40 m-0 mb-1">Header obrigatório</p>
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
              <code className="text-xs flex-1 text-white/70">Authorization: Bearer &lt;WEBHOOK_API_KEY&gt;</code>
              <CopyButton text="Authorization: Bearer <WEBHOOK_API_KEY>" />
            </div>
          </div>
        ) : null}
        <details className="text-xs text-white/50">
          <summary className="cursor-pointer text-[#39FF14] font-medium hover:underline">
            Ver exemplo de payload
          </summary>
          <pre className="mt-2 rounded-lg border border-white/10 bg-black/40 p-3 overflow-x-auto text-[11px] leading-relaxed text-white/70">{`POST ${painelApi.paymentsWebhook}
Authorization: Bearer fmk_...
Content-Type: application/json

{
  "loja_id": "${lojaId || '<uuid-da-loja>'}",
  "terminal": "stone",
  "bandeira": "visa",
  "external_ref": "TXN_abc123",
  "valor_total": 149.90,
  "metodo": "credito",
  "status": "aprovado",
  "items": [
    { "produto_loja_id": "<uuid-produto>", "quantidade": 2, "preco_unitario": 49.95 }
  ]
}`}</pre>
        </details>
        <p className="text-xs text-white/40 m-0">
          App Android (sessão lojista): <code className="text-white/60">POST /api/merchant/vendas</code>
        </p>
      </div>
    </div>
  );
}
