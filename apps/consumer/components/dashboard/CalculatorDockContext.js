'use client';

import { createContext, useCallback, useContext, useMemo, useState, Fragment } from 'react';
import { DockedQuickCalculator } from './DockedQuickCalculator';

const CalculatorDockContext = createContext(null);

function normalizeAmountForExpr(amount) {
  const n = Math.abs(Number(amount));
  if (!Number.isFinite(n)) return null;
  return n.toString().replace(/,/g, '.');
}

function computeFlyTarget(clientX, clientY, desktopOpen) {
  if (typeof window === 'undefined') return { x1: clientX, y1: clientY };
  const w = window.innerWidth;
  const h = window.innerHeight;
  const lg = w >= 1024;
  const dockW = Math.min(300, w * 0.28);
  if (lg && desktopOpen) {
    return { x1: w - dockW * 0.5 - 8, y1: h * 0.28 };
  }
  if (lg && !desktopOpen) {
    return { x1: w - 28, y1: h * 0.5 };
  }
  /** Mobile: centro da barra da calculadora (acima do BottomNav). */
  const bottomReserve = 4.5 * 16 + 52 + 24;
  return { x1: w * 0.5, y1: Math.max(80, h - bottomReserve) };
}

export function CalculatorDockProvider({ children }) {
  const [expr, setExpr] = useState('');
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [pulseKey, setPulseKey] = useState(0);
  /** Partícula “voando” do histórico até à calculadora. */
  const [flyParticle, setFlyParticle] = useState(null);

  const appendAmount = useCallback(
    (amount, sign, options = {}) => {
      const numStr = normalizeAmountForExpr(amount);
      if (!numStr) return;
      /** Se false, só acrescenta após operador na expressão (fluxo cartões bancários). */
      const allowImplicitJoin = options?.allowImplicitJoin !== false;
      setExpr((prev) => {
        const p = String(prev || '').trimEnd();
        if (!p) return sign === '-' ? `-${numStr}` : numStr;
        if (/[+\-*/]$/.test(p)) return `${p}${numStr}`;
        if (allowImplicitJoin) return `${p}${sign === '-' ? ' - ' : ' + '}${numStr}`;
        return p;
      });
      setPulseKey((k) => k + 1);

      const flyFrom = options?.flyFrom;
      if (
        flyFrom &&
        typeof flyFrom.clientX === 'number' &&
        typeof flyFrom.clientY === 'number' &&
        typeof window !== 'undefined'
      ) {
        const { x1, y1 } = computeFlyTarget(flyFrom.clientX, flyFrom.clientY, desktopOpen);
        const label =
          options?.flyLabel ||
          new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(numStr));
        const id = Date.now() + Math.random();
        setFlyParticle({
          id,
          x0: flyFrom.clientX,
          y0: flyFrom.clientY,
          x1,
          y1,
          label,
        });
        window.setTimeout(() => {
          setFlyParticle((cur) => (cur && cur.id === id ? null : cur));
        }, 520);
      }
    },
    [desktopOpen]
  );

  const appendChar = useCallback((ch) => {
    setExpr((prev) => `${prev}${ch}`);
  }, []);

  const clear = useCallback(() => setExpr(''), []);
  const backspace = useCallback(() => setExpr((prev) => prev.slice(0, -1)), []);

  const value = useMemo(
    () => ({
      expr,
      setExpr,
      appendAmount,
      appendChar,
      clear,
      backspace,
      mobileExpanded,
      setMobileExpanded,
      pulseKey,
      desktopOpen,
      setDesktopOpen,
      flyParticle,
    }),
    [
      expr,
      appendAmount,
      appendChar,
      clear,
      backspace,
      mobileExpanded,
      pulseKey,
      desktopOpen,
      flyParticle,
    ]
  );

  return (
    <CalculatorDockContext.Provider value={value}>
      <Fragment>
        {children}
        <DockedQuickCalculator />
      </Fragment>
    </CalculatorDockContext.Provider>
  );
}

export function useCalculatorDock() {
  const ctx = useContext(CalculatorDockContext);
  if (!ctx) {
    throw new Error('useCalculatorDock must be used within CalculatorDockProvider');
  }
  return ctx;
}

/** Para listas usadas fora do dashboard (não quebra). */
export function useCalculatorDockOptional() {
  return useContext(CalculatorDockContext);
}
