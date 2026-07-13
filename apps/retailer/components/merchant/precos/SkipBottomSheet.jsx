'use client';

import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

const SNAP_HEIGHTS = { collapsed: 0.15, half: 0.5, expanded: 0.85 };
const SNAP_ORDER = ['collapsed', 'half', 'expanded'];

function getTranslateForSnap(snap) {
  return (1 - SNAP_HEIGHTS[snap]) * window.innerHeight;
}

export function SkipBottomSheet({ header, children, className = '' }) {
  const sheetRef = useRef(null);
  const snapPointRef = useRef('collapsed');
  const dragStartY = useRef(0);
  const currentTranslate = useRef(0);
  const baseTranslate = useRef(0);
  const dragStartTime = useRef(0);
  const hasDragged = useRef(false);
  const rafId = useRef(null);

  const applyTransform = useCallback((y) => {
    if (sheetRef.current) sheetRef.current.style.transform = `translateY(${y}px)`;
    currentTranslate.current = y;
  }, []);

  const snapTo = useCallback(
    (point) => {
      snapPointRef.current = point;
      const y = getTranslateForSnap(point);
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      }
      applyTransform(y);
      baseTranslate.current = y;
    },
    [applyTransform]
  );

  useLayoutEffect(() => {
    const y = getTranslateForSnap('collapsed');
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
    applyTransform(y);
    baseTranslate.current = y;
    requestAnimationFrame(() => {
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      }
    });
  }, [applyTransform]);

  useEffect(() => {
    const handleResize = () => snapTo(snapPointRef.current);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [snapTo]);

  const handlePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartY.current = e.clientY;
    baseTranslate.current = currentTranslate.current;
    dragStartTime.current = Date.now();
    hasDragged.current = false;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  };

  const handlePointerMove = (e) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const delta = e.clientY - dragStartY.current;
    if (Math.abs(delta) > 4) hasDragged.current = true;
    const newTranslate = Math.min(
      (1 - SNAP_HEIGHTS.collapsed) * window.innerHeight + 60,
      Math.max(0, baseTranslate.current + delta)
    );
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => applyTransform(newTranslate));
  };

  const handlePointerUp = (e) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!hasDragged.current) {
      const idx = SNAP_ORDER.indexOf(snapPointRef.current);
      snapTo(SNAP_ORDER[(idx + 1) % SNAP_ORDER.length]);
      return;
    }
    const visiblePercent = 1 - currentTranslate.current / window.innerHeight;
    let targetSnap = snapPointRef.current;
    let minDist = Infinity;
    for (const snap of SNAP_ORDER) {
      const dist = Math.abs(visiblePercent - SNAP_HEIGHTS[snap]);
      if (dist < minDist) {
        minDist = dist;
        targetSnap = snap;
      }
    }
    snapTo(targetSnap);
  };

  return (
    <div
      ref={sheetRef}
      className={`fixed top-0 left-0 right-0 z-40 bg-[#0a0a0f] rounded-t-3xl border-t border-white/10 shadow-2xl flex flex-col overflow-hidden ${className}`}
      style={{ height: '100vh', willChange: 'transform' }}
    >
      <div
        className="flex justify-center items-center shrink-0 cursor-grab active:cursor-grabbing min-h-[44px]"
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="w-10 h-1.5 bg-white/20 rounded-full" />
      </div>
      <div className="shrink-0">{header}</div>
      <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}
