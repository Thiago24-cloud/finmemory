'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { MascotImage } from '../gamification/MascotImage';

const MOOD_CLASS = {
  neutral: '',
  happy: 'brightness-110 saturate-110 scale-105',
  alert: 'hue-rotate-[320deg] saturate-125',
};

/**
 * Balão do tutor + mascote (port web do TutorOverlay React Native).
 *
 * @param {{
 *   visible?: boolean,
 *   title?: string,
 *   text: string,
 *   position?: 'top' | 'bottom' | 'center',
 *   mood?: 'neutral' | 'happy' | 'alert',
 *   onContinue?: () => void,
 *   continueLabel?: string,
 *   className?: string,
 *   mascotWidth?: number,
 * }} props
 */
export function TutorOverlay({
  visible = true,
  title,
  text,
  position = 'bottom',
  mood = 'neutral',
  onContinue,
  continueLabel = 'Continuar →',
  className,
  mascotWidth = 85,
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="tutor-overlay"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className={cn(
            'flex flex-row items-center gap-3 w-full',
            position === 'center' && 'justify-center',
            className
          )}
        >
          <motion.div
            className={cn(
              'flex-1 min-w-0 rounded-[14px] border-[1.5px] border-[#00E676] bg-[#1C1C1E] p-4',
              'shadow-[0_4px_8px_rgba(0,230,118,0.15)]'
            )}
            layout
          >
            {title ? (
              <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em] text-[#00E676]">
                {title}
              </p>
            ) : null}
            <p
              className={cn(
                'm-0 text-sm font-medium leading-5 text-[#F2F2F7]',
                title && 'mt-1.5'
              )}
            >
              {text}
            </p>
            {onContinue ? (
              <button
                type="button"
                onClick={onContinue}
                className="mt-2.5 ml-auto block px-2 py-1 text-[13px] font-bold uppercase text-[#00E676] hover:text-[#5dffa8] transition-colors"
              >
                {continueLabel}
              </button>
            ) : null}
          </motion.div>
          <div className={cn('shrink-0', MOOD_CLASS[mood] || MOOD_CLASS.neutral)}>
            <MascotImage width={mascotWidth} className="pointer-events-none select-none" />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
