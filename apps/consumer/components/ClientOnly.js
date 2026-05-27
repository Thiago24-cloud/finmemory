import { useEffect, useState } from 'react';

/**
 * Renderiza children apenas no cliente (após mount).
 * Evita "window is not defined" / "document is not defined" durante SSR.
 */
export default function ClientOnly({ children, fallback = null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return fallback;
  return children;
}
