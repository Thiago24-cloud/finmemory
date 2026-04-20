import { useState, useLayoutEffect } from 'react';

/**
 * `defaultMatches` — valor só no SSR (sem `window`).
 * No cliente usa **useLayoutEffect** para ler `matchMedia` antes do paint, evitando que o mapa
 * trate o telefone como “desktop” na 1ª frame (folha mobile, padding e blur não apareciam).
 */
export function useMatchMedia(query, defaultMatches = false) {
  const [matches, setMatches] = useState(defaultMatches);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    setMatches(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
