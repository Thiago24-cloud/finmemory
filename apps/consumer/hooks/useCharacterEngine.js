import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveCharacterState } from '../lib/gamification/resolveCharacterState';
import { pickRandomSpeech } from '../lib/gamification/characterSpeeches.js';
import {
  CHARACTER_BUBBLE_DELAY_MS,
  CHARACTER_CLICK_DEBOUNCE_MS,
} from '../lib/gamification/characterAnimation';

/**
 * Motor do mascote — resolve estado localmente (rápido) com opção de sync servidor.
 * @param {import('../lib/gamification/resolveCharacterState').CharacterSignals} signals
 * @param {{ syncServer?: boolean }} [options]
 */
export function useCharacterEngine(signals, options = {}) {
  const { syncServer = false } = options;
  const [speech, setSpeech] = useState('');
  const [isBouncing, setIsBouncing] = useState(false);
  const [showBubble, setShowBubble] = useState(false);
  const [serverEngine, setServerEngine] = useState(null);
  const bubbleTimerRef = useRef(null);
  const lastClickRef = useRef(0);

  const signalsKey = useMemo(() => JSON.stringify(signals || {}), [signals]);

  const localEngine = useMemo(() => {
    return resolveCharacterState(signals).character_engine;
  }, [signalsKey]);

  const engine = serverEngine || localEngine;

  const runBubbleSequence = useCallback((nextSpeech) => {
    if (nextSpeech) setSpeech(nextSpeech);
    setIsBouncing(true);
    setShowBubble(false);

    if (bubbleTimerRef.current) {
      window.clearTimeout(bubbleTimerRef.current);
    }

    bubbleTimerRef.current = window.setTimeout(() => {
      setIsBouncing(false);
      setShowBubble(true);
      bubbleTimerRef.current = null;
    }, CHARACTER_BUBBLE_DELAY_MS);
  }, []);

  /** Reage a mudança de estado (aba / sinais) com fala + quique + balão atrasado. */
  useEffect(() => {
    const next =
      engine.current_speech || pickRandomSpeech(engine.current_state);
    runBubbleSequence(next);
  }, [engine.current_state, engine.current_speech, runBubbleSequence]);

  useEffect(() => {
    if (!syncServer) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/gamification/character-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(signals),
        });
        const data = await res.json();
        if (!cancelled && res.ok && data.character_engine) {
          setServerEngine(data.character_engine);
        }
      } catch (_) {
        /* fallback local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signalsKey, syncServer]);

  useEffect(() => {
    return () => {
      if (bubbleTimerRef.current) {
        window.clearTimeout(bubbleTimerRef.current);
      }
    };
  }, []);

  /** Clique no mascote — debounce tátil + nova fala + bounce (Task 6/7). */
  const refreshSpeech = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < CHARACTER_CLICK_DEBOUNCE_MS) return;
    lastClickRef.current = now;

    const next = pickRandomSpeech(engine.current_state);
    runBubbleSequence(next);
  }, [engine.current_state, runBubbleSequence]);

  return {
    engine,
    speech,
    isBouncing,
    showBubble,
    refreshSpeech,
  };
}
