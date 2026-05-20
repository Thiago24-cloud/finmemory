'use client';

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';
import { MascotImage } from '../gamification/MascotImage';

const Z = 260;

/**
 * Modal premium escuro — título, texto e CTA “Próximo”.
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   body: string,
 *   stepIndex?: number,
 *   stepCount?: number,
 *   isLast?: boolean,
 *   mascotLine?: string,
 *   showMascot?: boolean,
 *   coachMode?: boolean,
 *   onNext: () => void,
 *   onSkip?: () => void,
 * }} props
 */
export function OnboardingPremiumModal({
  open,
  title,
  body,
  mascotLine,
  showMascot = false,
  coachMode = false,
  stepIndex = 0,
  stepCount = 1,
  isLast = false,
  onNext,
  onSkip,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="onboarding-premium-modal"
          className="fixed inset-0 flex items-end sm:items-center justify-center p-4 sm:p-6"
          style={{ zIndex: Z }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-black/55 backdrop-blur-[3px]"
            aria-label="Fechar"
            onClick={onSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboarding-premium-title"
            className={cn(
              'relative w-full max-w-md rounded-2xl overflow-hidden',
              'bg-[#0a0a12]/98 border border-[#00E676]/35',
              'shadow-[0_24px_80px_rgba(0,230,118,0.12),0_8px_32px_rgba(0,0,0,0.6)]'
            )}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <div className="relative px-5 pt-5 pb-4 border-b border-white/8 bg-gradient-to-br from-[#00E676]/10 via-transparent to-transparent">
              {onSkip ? (
                <button
                  type="button"
                  onClick={onSkip}
                  className="absolute top-3 right-3 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                  aria-label="Pular tutorial"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
              <div className="flex items-center gap-2 text-[#00E676] mb-1.5">
                <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                  {coachMode ? 'Dica do seu guia' : 'Descubra o FinMemory'}
                </span>
              </div>
              <div className="flex gap-3 items-start pr-8">
                {showMascot ? (
                  <div className="shrink-0 -mt-1">
                    <MascotImage width={64} className="pointer-events-none select-none" />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h2
                    id="onboarding-premium-title"
                    className="text-xl font-bold text-[#F2F2F7] tracking-tight"
                  >
                    {title}
                  </h2>
                  {mascotLine ? (
                    <p className="mt-1.5 text-xs font-medium text-[#00E676]/90 leading-snug m-0">
                      {mascotLine}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-[#F2F2F7]/85 leading-relaxed m-0">{body}</p>
              <div className="flex justify-center gap-1.5 mt-5" aria-hidden>
                {Array.from({ length: stepCount }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      i === stepIndex ? 'w-6 bg-[#00E676]' : 'w-1.5 bg-white/20'
                    )}
                  />
                ))}
              </div>
            </div>
            <div className="px-5 pb-5 flex items-center justify-between gap-3">
              {onSkip ? (
                <button
                  type="button"
                  onClick={onSkip}
                  className="text-sm font-medium text-white/45 hover:text-white/75 py-2 px-1"
                >
                  Pular
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={onNext}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00E676] text-[#050508] font-bold text-sm px-5 py-2.5 hover:bg-[#5dffa8] transition-colors shadow-[0_0_20px_rgba(0,230,118,0.35)]"
              >
                {isLast ? (coachMode ? 'Entendi' : 'Começar') : 'Próximo'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
