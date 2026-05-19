/**
 * Envio push via OneSignal REST (external_user_id = users.id).
 */

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
    'https://finmemory.com.br'
  );
}

export function isOneSignalConfigured() {
  return Boolean(process.env.ONESIGNAL_APP_ID?.trim() && process.env.ONESIGNAL_REST_API_KEY?.trim());
}

/**
 * @param {string[]} userIds
 * @param {{ title: string, body: string, url?: string }} payload
 */
export async function sendOneSignalToUsers(userIds, payload) {
  const appId = process.env.ONESIGNAL_APP_ID?.trim();
  const apiKey = process.env.ONESIGNAL_REST_API_KEY?.trim();
  if (!appId || !apiKey) {
    return { ok: false, skipped: true, reason: 'onesignal_not_configured', sent: 0 };
  }

  const ids = [...new Set((userIds || []).map((id) => String(id).trim()).filter(Boolean))];
  if (ids.length === 0) {
    return { ok: true, skipped: false, sent: 0, id: null };
  }

  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify({
      app_id: appId,
      include_external_user_ids: ids.slice(0, 2000),
      channel_for_external_user_ids: 'push',
      headings: { en: payload.title, pt: payload.title },
      contents: { en: payload.body, pt: payload.body },
      url: payload.url || `${appBaseUrl()}/mapa`,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      skipped: false,
      sent: 0,
      reason: json?.errors?.[0] || res.statusText,
      raw: json,
    };
  }

  return { ok: true, id: json?.id, sent: ids.length, recipients: json?.recipients };
}

export async function sendOneSignalToUser(userId, payload) {
  return sendOneSignalToUsers([userId], payload);
}
