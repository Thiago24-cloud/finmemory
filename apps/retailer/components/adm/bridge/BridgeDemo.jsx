'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ShieldCheck,
  Wallet,
  Workflow,
} from 'lucide-react';
import { useBridgeContext } from './BridgeContext';
import { fmtCurrency } from '../../../lib/adm/bridgeFormat';
import { buildConsumerMapUrl } from '../../../lib/consumerAppUrl';

export function BridgeDemo({ onGoNota, onGoCampanhas, onGoCarteira, onGoValidar }) {
  const { selectedMerchant } = useBridgeContext();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [simulateMsg, setSimulateMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const email = selectedMerchant?.email ? `?email=${encodeURIComponent(selectedMerchant.email)}` : '';
      const res = await fetch(`/api/parceiros/demo/investor${email}`);
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [selectedMerchant?.email]);

  useEffect(() => {
    load();
  }, [load]);

  async function runSimulation() {
    setSimulateMsg('');
    const campaign = data?.active_campaigns?.[0];
    const user = data?.demo_user;
    if (!campaign || !user) {
      setSimulateMsg('Configure campanhas ativas e um comerciante demo (seed).');
      return;
    }
    const res = await fetch('/api/parceiros/adm/campaigns/validate-purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: user.id,
        campaign_id: campaign.id,
        product_name: campaign.product_name,
        market_name: 'Atacadão Demo',
        purchase_amount: 11.9,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setSimulateMsg(json.error || 'Falha na simulação');
      return;
    }
    setSimulateMsg(`Crédito concedido — saldo: ${fmtCurrency(json.balance)}`);
    load();
  }

  const walletBalance = data?.wallet?.balance;
  const lastTx = data?.transactions?.[0];
  const activeCampaign = data?.active_campaigns?.[0];
  const mapUrl = buildConsumerMapUrl({ from: 'adm-bridge-demo' });

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-8">
      <div className="text-center space-y-3 py-4">
        <span className="inline-block rounded-full border border-primary/20 bg-primary/10 text-primary text-sm px-4 py-1">
          Demonstração para Investidores
        </span>
        <h2 className="text-3xl font-bold tracking-tight">O Ciclo FinMemory</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Como transformamos notas fiscais de pequenos estabelecimentos em ativos auditáveis de marketing.
        </p>
      </div>

      <div className="relative space-y-10">
        <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-border hidden md:block" />

        {/* Step 1 */}
        <DemoStep icon={Camera} title="1. A Ponte de Dados (OCR)">
          <p className="text-muted-foreground mb-4">
            O operador tira foto da nota de entrada. A IA extrai itens, padroniza nomenclaturas e injeta
            quantidades e custos no ERP.
          </p>
          <div className="bg-muted/50 rounded-lg border p-4 text-sm font-mono space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fornecedor:</span>
              <span>Atacadão S.A.</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Item Extraído:</span>
              <span className="text-primary font-bold">Queijo Parmesão Nestlé 1kg</span>
            </div>
          </div>
          <button type="button" onClick={onGoNota} className="text-sm text-primary hover:underline inline-flex items-center">
            Ver Módulo OCR <ArrowRight className="w-3 h-3 ml-1" />
          </button>
        </DemoStep>

        {/* Step 2 */}
        <DemoStep icon={Workflow} title="2. O Motor de Campanhas">
          <p className="text-muted-foreground mb-4">
            Itens extraídos são cruzados com campanhas ativas da indústria. Marcas patrocinam cashbacks.
          </p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : activeCampaign ? (
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Match Encontrado</span>
              <p className="font-bold text-lg mt-2">{activeCampaign.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {activeCampaign.partner_name} bonifica{' '}
                <strong>{fmtCurrency(activeCampaign.reward_amount)}</strong> por {activeCampaign.product_name}.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">Nenhuma campanha ativa.</p>
          )}
          <button type="button" onClick={onGoCampanhas} className="text-sm text-primary hover:underline inline-flex items-center">
            Ver Motor de Campanhas <ArrowRight className="w-3 h-3 ml-1" />
          </button>
        </DemoStep>

        {/* Step 3 */}
        <DemoStep icon={ShieldCheck} title="3. Auditoria Imutável (Web3 Ready)">
          <p className="text-muted-foreground mb-4">
            Cada crédito gera hash auditável. A indústria tem certeza de que o dinheiro chegou à ponta.
          </p>
          {lastTx?.blockchain_tx_hash ? (
            <div className="bg-[#111] text-[#0f0] p-4 rounded-lg font-mono text-xs overflow-x-auto mb-4">
              <div>{'>'} transaction_signed</div>
              <div>{'>'} generating_hash…</div>
              <div className="mt-2 text-white/80">Hash Gerado:</div>
              <div className="break-all">{lastTx.blockchain_tx_hash}</div>
              <div className="mt-2 text-white/50">Amount: {fmtCurrency(lastTx.amount)}</div>
            </div>
          ) : (
            <div className="bg-[#111] text-white/50 p-4 rounded-lg font-mono text-xs text-center mb-4">
              Aguardando a primeira transação para gerar hash…
            </div>
          )}
          <button type="button" onClick={onGoValidar} className="text-sm text-primary hover:underline inline-flex items-center">
            Simular validação <ArrowRight className="w-3 h-3 ml-1" />
          </button>
        </DemoStep>

        {/* Step 4 */}
        <DemoStep icon={Wallet} title="4. O Valor na Ponta" highlight>
          <p className="text-muted-foreground mb-4">
            O estabelecimento acumula saldo na carteira FinMemory — dinheiro na mesa que fideliza ao ecossistema.
          </p>
          <div className="flex items-center justify-between p-6 bg-primary text-primary-foreground rounded-xl mb-4">
            <div>
              <p className="text-sm opacity-80 uppercase tracking-wider">
                Saldo de {selectedMerchant?.store_name || data?.demo_user?.name || 'Estabelecimento'}
              </p>
              <p className="text-4xl font-bold mt-1">{fmtCurrency(walletBalance || 0)}</p>
            </div>
            <CheckCircle2 className="w-12 h-12 opacity-50" />
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={runSimulation}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Simular compra + crédito
            </button>
            <button type="button" onClick={onGoCarteira} className="text-sm text-primary hover:underline">
              Acessar Carteira
            </button>
            <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:underline">
              Mapa Caça-Preço
            </a>
          </div>
          {simulateMsg ? <p className="text-sm text-primary mt-3">{simulateMsg}</p> : null}
        </DemoStep>
      </div>
    </div>
  );
}

function DemoStep({ icon: Icon, title, children, highlight }) {
  return (
    <div className="relative flex gap-6 md:gap-8 items-start">
      <div
        className={`hidden md:flex w-16 h-16 rounded-full border-2 items-center justify-center z-10 shrink-0 ${
          highlight ? 'border-primary bg-primary/5' : 'border-primary bg-card'
        }`}
      >
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div
        className={`flex-1 rounded-xl border overflow-hidden ${
          highlight ? 'border-primary border-2 shadow-md' : 'border-border'
        }`}
      >
        <div className={`p-4 border-b flex items-center gap-3 ${highlight ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border'}`}>
          <div className="md:hidden w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-bold text-lg">{title}</h3>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
