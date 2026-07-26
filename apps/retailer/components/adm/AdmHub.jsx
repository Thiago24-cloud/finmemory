'use client';

import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft } from 'lucide-react';
import { AdmCompraPanel } from './AdmCompraPanel';
import { FinMemoryBridgePanel } from './FinMemoryBridgePanel';

const HUBS = [
  {
    id: 'bridge',
    label: 'FinMemory Bridge MVP',
    description: 'Início, Carteira, Campanhas, Nota, Catálogo e Demo.',
  },
  {
    id: 'compra',
    label: 'ADM FinMemory Compra',
    description: 'Usuários, produtos, mercados, preços e alertas WhatsApp.',
  },
];

export function AdmHub({ initialHub = 'bridge', initialView = 'carteira' }) {
  const router = useRouter();
  const hub = typeof router.query.hub === 'string' ? router.query.hub : initialHub;
  const view = typeof router.query.view === 'string' ? router.query.view : initialView;
  const activeHub = HUBS.some((h) => h.id === hub) ? hub : 'bridge';

  function setHub(id) {
    const query = { hub: id };
    if (id === 'bridge') query.view = view && view !== 'catalogo' ? view : 'carteira';
    router.replace({ pathname: '/parceiros/adm', query }, undefined, { shallow: true });
  }

  /* Modo Bridge: app FinMemory full-screen, menu à esquerda (igual Replit) */
  if (activeHub === 'bridge') {
    return (
      <FinMemoryBridgePanel
        initialView={view}
        onOpenAdmCompra={() => setHub('compra')}
      />
    );
  }

  const hubMeta = HUBS.find((h) => h.id === activeHub);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5 pb-10">
      <div>
        <Link
          href="/parceiros/painel"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao painel
        </Link>
        <h1 className="text-xl font-bold m-0">ADM FinMemory</h1>
        <p className="text-sm text-muted-foreground m-0 mt-1">
          Área exclusiva para administradores.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {HUBS.map((h) => (
          <button
            key={h.id}
            type="button"
            onClick={() => setHub(h.id)}
            className={`rounded-xl border p-4 text-left transition-all ${
              activeHub === h.id
                ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <p className="font-semibold text-sm m-0">{h.label}</p>
            <p className="text-xs text-muted-foreground m-0 mt-1">{h.description}</p>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-muted/20 px-4 py-2">
        <p className="text-xs text-muted-foreground m-0">
          Módulo ativo: <strong className="text-foreground">{hubMeta?.label}</strong>
        </p>
      </div>

      <AdmCompraPanel embedded />
    </div>
  );
}
