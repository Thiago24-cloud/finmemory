'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

/**
 * Balão estilo HQ (fundo claro, borda preta, detalhes dourados).
 */
export function CacaPrecoSpeechBubble({ text, className, onTap }) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={text}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.35 }}
        className={cn('relative min-w-0 flex-1', className)}
      >
        <div
          role={onTap ? 'button' : undefined}
          tabIndex={onTap ? 0 : undefined}
          onClick={onTap}
          onKeyDown={
            onTap
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onTap();
                  }
                }
              : undefined
          }
          className={cn(
            'relative rounded-xl border-2 border-black bg-white px-4 py-3 shadow-[0_6px_20px_rgba(0,0,0,0.18)]',
            onTap && 'cursor-pointer hover:bg-zinc-50'
          )}
        >
          <span className="absolute left-1 top-1 h-2.5 w-2.5 border-l-2 border-t-2 border-[#C9A227] rounded-tl" aria-hidden />
          <span className="absolute right-1 top-1 h-2.5 w-2.5 border-r-2 border-t-2 border-[#C9A227] rounded-tr" aria-hidden />
          <span className="absolute left-1 bottom-1 h-2.5 w-2.5 border-l-2 border-b-2 border-[#C9A227] rounded-bl" aria-hidden />
          <span className="absolute right-1 bottom-1 h-2.5 w-2.5 border-r-2 border-b-2 border-[#C9A227] rounded-br" aria-hidden />
          <p className="m-0 text-sm font-bold leading-snug text-black sm:text-[15px]">{text}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
