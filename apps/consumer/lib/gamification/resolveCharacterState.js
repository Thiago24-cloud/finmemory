import { CHARACTER_STATE_CONFIG } from './characterStateConfig';
import { pickRandomSpeech } from './characterSpeeches.js';

/**
 * @typedef {import('./characterSpeeches').CharacterStateId} CharacterStateId
 */

/**
 * Sinais leves vindos da Dashboard / Mapa (sem query extra pesada).
 * @typedef {object} CharacterSignals
 * @property {'dashboard'|'map'} [context]
 * @property {boolean} [loading]
 * @property {boolean} [hasOpenFinanceAccounts]
 * @property {boolean} [syncing]
 * @property {number} [expenseTotal]
 * @property {number} [incomeTotal]
 * @property {boolean} [allMissionsComplete]
 * @property {boolean} [hasAnyMission]
 * @property {number} [streakCurrent]
 * @property {boolean} [welcomeBackToday]
 */

/**
 * Árvore de decisão do mascote (prioridade: alerta > vitória > contexto > padrão).
 * @param {CharacterSignals} signals
 * @returns {object} character_engine payload
 */
export function resolveCharacterState(signals = {}) {
  const context = signals.context || 'dashboard';

  if (signals.loading) {
    return buildEnginePayload('IDLE', signals);
  }

  if (context === 'map') {
    return buildEnginePayload('PRICE_MAP_HUNT', signals);
  }

  const expense = Number(signals.expenseTotal) || 0;
  const income = Number(signals.incomeTotal) || 0;

  if (income > 0 && expense >= income * 0.92) {
    return buildEnginePayload('BUDGET_CRUNCH', signals);
  }

  if (expense > 0 && income <= 0 && expense > 500) {
    return buildEnginePayload('BUDGET_CRUNCH', signals);
  }

  if (signals.allMissionsComplete && signals.hasAnyMission) {
    return buildEnginePayload('META_BATIDA', signals);
  }

  if (signals.welcomeBackToday) {
    return buildEnginePayload('META_BATIDA', signals);
  }

  if (signals.hasOpenFinanceAccounts && (signals.syncing || signals.justSynced)) {
    return buildEnginePayload('OPEN_FINANCE_ANALYZE', signals);
  }

  if (signals.hasOpenFinanceAccounts) {
    return buildEnginePayload('OPEN_FINANCE_ANALYZE', signals);
  }

  if ((signals.streakCurrent || 0) >= 3) {
    return buildEnginePayload('META_BATIDA', signals);
  }

  return buildEnginePayload('IDLE', signals);
}

/**
 * @param {CharacterStateId} stateId
 * @param {CharacterSignals} signals
 */
function buildEnginePayload(stateId, signals) {
  const cfg = CHARACTER_STATE_CONFIG[stateId] || CHARACTER_STATE_CONFIG.IDLE;
  const speech = pickRandomSpeech(stateId);

  return {
    character_engine: {
      current_state: stateId,
      mood_level: cfg.mood_level,
      animation_profile: cfg.animation_profile || 'float-idle',
      animation_trigger: cfg.animation_trigger,
      current_speech: speech,
      ui_config: { ...cfg.ui_config },
    },
  };
}

/**
 * Serializa para API / logs.
 * @param {string} userId
 * @param {CharacterSignals} signals
 */
export function buildCharacterEngineResponse(userId, signals) {
  const { character_engine } = resolveCharacterState(signals);
  return {
    user_id: userId,
    character_engine,
  };
}
