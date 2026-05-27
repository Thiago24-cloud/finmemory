import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { sendReengagementPush } from '../../../lib/push/reengagementPush';

const INACTIVE_HOURS = 48;
const COOLDOWN_HOURS = 24;
const BATCH_LIMIT = 200;

function requireCronSecret(req) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return { ok: true };
  const provided =
    req.headers['x-cron-secret'] ||
    req.headers['X-Cron-Secret'] ||
    req.query?.secret;
  if (provided !== secret) return { ok: false, status: 401 };
  return { ok: true };
}

/**
 * POST /api/cron/reengagement-inactive
 * Usuários sem login há 48h+ → push (OneSignal se configurado).
 * Header: x-cron-secret = CRON_SECRET
 */
export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = requireCronSecret(req);
  if (!auth.ok) {
    return res.status(auth.status).json({ error: 'Unauthorized' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase indisponível' });
  }

  const cutoff = new Date(Date.now() - INACTIVE_HOURS * 3600000).toISOString();
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600000).toISOString();

  try {
    const { data: candidates, error } = await supabase
      .from('users')
      .select('id, name, streak_current, last_login_at, email')
      .not('last_login_at', 'is', null)
      .lt('last_login_at', cutoff)
      .limit(BATCH_LIMIT);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const rows = candidates || [];
    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const user of rows) {
      const { data: recent } = await supabase
        .from('reengagement_push_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('campaign', 'inactive_48h')
        .gte('sent_at', cooldownCutoff)
        .limit(1);

      if (recent?.length) {
        skipped += 1;
        continue;
      }

      try {
        const result = await sendReengagementPush(supabase, user);
        if (result.ok) sent += 1;
        else if (result.skipped) skipped += 1;
        else errors.push({ user_id: user.id, reason: result.reason });
      } catch (e) {
        errors.push({ user_id: user.id, reason: e?.message || 'send_failed' });
      }
    }

    return res.status(200).json({
      success: true,
      scanned: rows.length,
      push_sent: sent,
      skipped,
      errors: errors.slice(0, 20),
      onesignal_configured: Boolean(
        process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY
      ),
    });
  } catch (e) {
    console.error('[reengagement-inactive]', e);
    return res.status(500).json({
      success: false,
      error: e?.message || 'Erro no cron de reengajamento',
    });
  }
}
