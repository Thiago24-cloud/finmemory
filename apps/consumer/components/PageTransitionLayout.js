'use client';

import { useReducedMotion } from 'framer-motion';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/router';

/**
 * Transição suave entre rotas (opacidade) sem remontar a BottomNav (fica fora deste wrapper em `_app`).
 */
export default function PageTransitionLayout({ children }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className="min-h-0">{children}</div>;
  }

  /** Sem `mode="wait"` — evita frame vazio entre rotas (piscar ao abrir /planos). */
  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={router.asPath}
        className="min-h-0"
        initial={{ opacity: 0.98 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.99 }}
        transition={{ duration: 0.08, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
