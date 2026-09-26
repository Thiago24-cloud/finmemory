'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import {
  Camera,
  Home,
  Package,
  Presentation,
  Tag,
  Wallet,
  ArrowLeft,
} from 'lucide-react';
import { BridgeProvider, BridgeMerchantSelector } from './bridge/BridgeContext';
import { BridgeDashboard } from './bridge/BridgeDashboard';
import { BridgeCarteira } from './bridge/BridgeCarteira';
import { BridgeCampanhas } from './bridge/BridgeCampanhas';
import { BridgeNovaCampanha } from './bridge/BridgeNovaCampanha';
import { BridgeNotaEntrada } from './bridge/BridgeNotaEntrada';
import { BridgeCatalogo } from './bridge/BridgeCatalogo';
import { BridgeDemo } from './bridge/BridgeDemo';
import { BridgeValidar } from './bridge/BridgeValidar';

const NAV = [
  { id: 'inicio', label: 'Início', icon: Home },
  { id: 'carteira', label: 'Carteira', icon: Wallet },
  { id: 'campanhas', label: 'Campanhas', icon: Tag },
  { id: 'nota', label: 'Nota', icon: Camera },
  { id: 'catalogo', label: 'Catálogo', icon: Package },
  { id: 'demo', label: 'Demo', icon: Presentation },
];

const MOBILE_NAV = NAV.filter((n) => ['inicio', 'carteira', 'campanhas', 'catalogo'].includes(n.id));

function BridgeBrand({ compact = false }) {
  return (
    <div className="fm-bridge-brand">
      <Image
        src="/logo.png"
        alt=""
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        className="rounded-lg"
        priority
      />
      <span className="fm-bridge-logo">FinMemory</span>
    </div>
  );
}

function BridgeApp({ initialView = 'carteira', onOpenAdmCompra }) {
  const router = useRouter();
  const [view, setView] = useState(initialView);

  useEffect(() => {
    const v = router.query.view;
    if (typeof v === 'string' && (NAV.some((n) => n.id === v) || v === 'nova-campanha' || v === 'validar')) {
      setView(v);
    }
  }, [router.query.view]);

  const go = useCallback(
    (id) => {
      setView(id);
      router.replace(
        { pathname: '/parceiros/adm', query: { hub: 'bridge', view: id } },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  function renderView() {
    if (view === 'nova-campanha') {
      return <BridgeNovaCampanha onBack={() => go('campanhas')} onCreated={() => go('campanhas')} />;
    }
    if (view === 'validar') {
      return <BridgeValidar onBack={() => go('campanhas')} />;
    }
    switch (view) {
      case 'inicio':
        return <BridgeDashboard />;
      case 'carteira':
        return <BridgeCarteira />;
      case 'campanhas':
        return (
          <BridgeCampanhas onNovaCampanha={() => go('nova-campanha')} onValidar={() => go('validar')} />
        );
      case 'nota':
        return <BridgeNotaEntrada onGoValidar={() => go('validar')} />;
      case 'catalogo':
        return <BridgeCatalogo />;
      case 'demo':
        return (
          <BridgeDemo
            onGoNota={() => go('nota')}
            onGoCampanhas={() => go('campanhas')}
            onGoCarteira={() => go('carteira')}
            onGoValidar={() => go('validar')}
          />
        );
      default:
        return <BridgeCarteira />;
    }
  }

  const activeNav =
    NAV.find((n) => n.id === view)?.id ||
    (view === 'nova-campanha' || view === 'validar' ? 'campanhas' : 'carteira');

  function renderNavButton(item, mobile = false) {
    const isActive = activeNav === item.id;
    const className = mobile
      ? `fm-bridge-mobile-nav-btn${isActive ? ' is-active' : ''}`
      : `fm-bridge-nav-btn${isActive ? ' is-active' : ''}`;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => go(item.id)}
        title={item.label}
        className={className}
      >
        <item.icon strokeWidth={isActive ? 2.25 : 2} />
        <span>{item.label}</span>
      </button>
    );
  }

  return (
    <BridgeProvider>
      <div className="fm-bridge-shell fm-bridge-app">
        {/* Mobile: topo com logo + seletor de comerciante */}
        <header className="fm-bridge-mobile-header">
          <div className="fm-bridge-mobile-header-row">
            <BridgeBrand compact />
            {onOpenAdmCompra ? (
              <button type="button" className="fm-bridge-foot-btn" onClick={onOpenAdmCompra} style={{ width: 'auto' }}>
                <ArrowLeft />
                ADM Compra
              </button>
            ) : null}
          </div>
          <BridgeMerchantSelector sidebar />
        </header>

        {/* Desktop: sidebar esquerda */}
        <aside className="fm-bridge-sidebar">
          <div className="fm-bridge-sidebar-head">
            <BridgeBrand />
          </div>

          <nav className="fm-bridge-sidebar-nav">
            {NAV.map((item) => renderNavButton(item))}
          </nav>

          <div className="fm-bridge-sidebar-foot">
            <BridgeMerchantSelector sidebar />
            {onOpenAdmCompra ? (
              <button type="button" className="fm-bridge-foot-btn" onClick={onOpenAdmCompra}>
                <ArrowLeft />
                ADM Compra
              </button>
            ) : null}
          </div>
        </aside>

        <main className="fm-bridge-main">
          <div className="fm-bridge-main-inner">{renderView()}</div>
        </main>

        {/* Mobile: menu inferior */}
        <nav className="fm-bridge-mobile-nav" aria-label="Menu principal">
          {MOBILE_NAV.map((item) => renderNavButton(item, true))}
        </nav>
      </div>
    </BridgeProvider>
  );
}

export function FinMemoryBridgePanel({ initialView, onOpenAdmCompra }) {
  return <BridgeApp initialView={initialView || 'carteira'} onOpenAdmCompra={onOpenAdmCompra} />;
}
