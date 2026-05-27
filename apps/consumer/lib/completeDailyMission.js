/**
 * POST /api/missions/complete — usar após ações reais (mapa, parceria, etc.).
 * @param {string} missionId ex.: 'find_cheaper', 'invite_friend'
 * @returns {Promise<Response>}
 */
export function completeDailyMission(missionId) {
  return fetch('/api/missions/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mission_id: missionId }),
  });
}
