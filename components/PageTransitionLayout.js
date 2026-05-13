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

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={router.asPath}
        className="min-h-0"
        initial={{ opacity: 0.92 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0.94 }}
        transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
