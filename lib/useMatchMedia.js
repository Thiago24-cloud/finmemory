import { useState, useEffect } from 'react';

/**
 * `defaultMatches` evita flash em SSR/hidratação (ex.: assumir mobile até o primeiro match).
 */
export function useMatchMedia(query, defaultMatches = false) {
  const [matches, setMatches] = useState(defaultMatches);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    onChange();
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
