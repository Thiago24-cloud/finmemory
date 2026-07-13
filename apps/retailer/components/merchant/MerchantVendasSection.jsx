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
import { SkipCard, SkipCardContent } from './skip/SkipCard';
import { SkipButton } from './skip/SkipButton';
import { SkipBadge } from './skip/SkipBadge';

function formatBrl(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'R$ 0,00';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const terminalClass = {
  stone: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  cielo: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  pagseguro: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
  mercadopago: 'bg-sky-500/10 text-sky-700 border-sky-500/30',
  rede: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
  other: 'bg-muted text-muted-foreground border-border',
};

const metodoClass = {
  credito: 'bg-violet-500/10 text-violet-700 border-violet-500/30',
  debito: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
  pix: 'bg-teal-500/10 text-teal-700 border-teal-500/30',
  dinheiro: 'bg-primary/10 text-primary border-primary/30',
};

const statusClass = {
  aprovado: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
  rejeitado: 'bg-red-500/10 text-red-700 border-red-500/30',
  cancelado: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <SkipButton variant="outline" size="icon" onClick={copy} className="shrink-0 h-8 w-8" aria-label="Copiar">
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </SkipButton>
  );
}

function VendaRow({ venda }) {
  const [open, setOpen] = useState(false);
  const ref = venda.externalRef || venda.external_ref;
  const isSim = ref?.startsWith('SIM_');

  return (
    <SkipCard className="shadow-subtle overflow-hidden">
      <button
        type="button"
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">#{String(venda.id).slice(0, 8)}</span>
            <SkipBadge className={terminalClass[venda.terminal] || terminalClass.other}>{venda.terminal}</SkipBadge>
            {venda.bandeira ? (
              <SkipBadge className="bg-muted text-muted-foreground border-border">{venda.bandeira}</SkipBadge>
            ) : null}
            <SkipBadge className={metodoClass[venda.metodo] || ''}>{venda.metodo}</SkipBadge>
            <SkipBadge className={statusClass[venda.status] || ''}>{venda.status}</SkipBadge>
            {isSim ? (
              <SkipBadge className="bg-yellow-500/15 text-yellow-700 border-yellow-500/30">simulado</SkipBadge>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground mt-1 m-0">
            {venda.createdAt ? new Date(venda.createdAt).toLocaleString('pt-BR') : '—'}
            {ref && !isSim ? (
              <>
                {' '}
                · <span className="font-mono text-[10px]">{ref}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-bold text-sm text-primary">{formatBrl(venda.valorTotal || venda.valor_total)}</span>
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </div>
      </button>
      {open && venda.items?.length > 0 ? (
        <div className="px-4 pb-3 pt-0 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mt-3 mb-2">Itens da venda</p>
          <ul className="space-y-1.5 list-none p-0 m-0">
            {venda.items.map((item) => (
              <li key={item.id} className="flex justify-between text-sm">
                <span>
                  {item.quantidade}× {item.nomeProduto || item.nome_produto}
                </span>
                <span className="text-muted-foreground">{formatBrl(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
            <span>Total</span>
            <span>{formatBrl(venda.valorTotal || venda.valor_total)}</span>
          </div>
        </div>
      ) : null}
    </SkipCard>
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
      const list = produtos.products || produtos;
      if (!Array.isArray(list) || list.length === 0) {
        setTestResult({
          ok: false,
          msg: 'Cadastre pelo menos um produto no Cardápio antes de simular.',
        });
        return;
      }
      const primeiro = list[0];
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
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 m-0">
            <ShoppingCart className="w-7 h-7 text-primary" />
            Vendas
          </h1>
          <p className="text-sm text-muted-foreground mt-1 m-0">
            Histórico de pagamentos recebidos pelas maquininhas e pelo app Android.
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider m-0">
            Faturamento hoje
          </p>
          <p className="text-lg font-bold text-primary m-0">{resumo ? formatBrl(resumo.receita_hoje) : '—'}</p>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 m-0" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground m-0 font-medium">Receita (24h)</p>
              <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-2xl font-bold m-0">{resumo ? formatBrl(resumo.receita_hoje) : '—'}</p>
            <p className="text-xs text-muted-foreground mt-1 m-0">{resumo?.vendas_hoje ?? 0} vendas aprovadas</p>
          </SkipCardContent>
        </SkipCard>
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground m-0 font-medium">Receita total</p>
              <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
            </div>
            <p className="text-2xl font-bold m-0">{resumo ? formatBrl(resumo.receita_total) : '—'}</p>
            <p className="text-xs text-muted-foreground mt-1 m-0">{resumo?.total_vendas ?? 0} vendas registradas</p>
          </SkipCardContent>
        </SkipCard>
        <SkipCard
          className={`shadow-subtle ${
            status?.key_configured ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
          }`}
        >
          <SkipCardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground m-0 font-medium">Segurança webhook</p>
              {status?.key_configured ? (
                <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden />
              ) : (
                <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
              )}
            </div>
            {status?.key_configured ? (
              <>
                <p className="text-sm font-semibold text-emerald-700 m-0">API Key ativa</p>
                <p className="text-xs text-muted-foreground font-mono mt-1 m-0">{status.key_prefix}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-700 m-0">Sem autenticação</p>
                <p className="text-xs text-muted-foreground mt-1 m-0">Configure WEBHOOK_API_KEY no servidor</p>
              </>
            )}
          </SkipCardContent>
        </SkipCard>
        <SkipCard className="shadow-subtle">
          <SkipCardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="h-4 w-4 text-muted-foreground" aria-hidden />
              <p className="text-xs text-muted-foreground m-0 font-medium">Simular pagamento</p>
            </div>
            <p className="text-xs text-muted-foreground m-0">Testa o pipeline sem maquininha real.</p>
            <SkipButton size="sm" className="mt-3" disabled={testLoading} onClick={() => void sendTestWebhook()}>
              {testLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              Simular
            </SkipButton>
            {testResult ? (
              <p className={`text-xs mt-2 m-0 ${testResult.ok ? 'text-primary' : 'text-destructive'}`}>{testResult.msg}</p>
            ) : null}
          </SkipCardContent>
        </SkipCard>
      </div>

      <div>
        <h3 className="text-sm font-bold m-0 mb-3 flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-primary" aria-hidden />
          Últimas vendas
        </h3>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-7 w-7 animate-spin text-primary" aria-label="Carregando" />
          </div>
        ) : vendas.length === 0 ? (
          <SkipCard className="border-dashed shadow-subtle">
            <SkipCardContent className="flex flex-col items-center py-16 text-center gap-3">
              <Clock className="h-10 w-10 text-muted-foreground opacity-50" aria-hidden />
              <p className="text-sm text-muted-foreground m-0 max-w-sm">
                Nenhuma venda registrada ainda. As vendas aparecem aqui quando a maquininha ou o app Android confirmar o pagamento.
              </p>
            </SkipCardContent>
          </SkipCard>
        ) : (
          <div className="space-y-2">
            {vendas.map((v) => (
              <VendaRow key={v.id} venda={v} />
            ))}
          </div>
        )}
      </div>

      <SkipCard className="border-dashed shadow-subtle">
        <SkipCardContent className="p-4 space-y-4">
          <p className="text-sm font-semibold m-0">Integração maquininha / Android</p>
          {lojaId ? (
            <p className="text-xs text-muted-foreground m-0">
              Loja: <span className="font-mono">{lojaId}</span> — inclua <code className="text-primary">loja_id</code> no payload do webhook.
            </p>
          ) : null}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground m-0 mb-1">Endpoint</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
              <code className="text-xs flex-1 truncate">{webhookUrl}</code>
              <CopyButton text={webhookUrl} />
            </div>
          </div>
          {status?.key_configured ? (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground m-0 mb-1">Header obrigatório</p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                <code className="text-xs flex-1">Authorization: Bearer &lt;WEBHOOK_API_KEY&gt;</code>
                <CopyButton text="Authorization: Bearer <WEBHOOK_API_KEY>" />
              </div>
            </div>
          ) : null}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer text-primary font-medium hover:underline">Ver exemplo de payload</summary>
            <pre className="mt-2 rounded-lg border border-border bg-muted/30 p-3 overflow-x-auto text-[11px] leading-relaxed">{`POST ${painelApi.paymentsWebhook}
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
        </SkipCardContent>
      </SkipCard>
    </div>
  );
}
