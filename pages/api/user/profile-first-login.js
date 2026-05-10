/**
 * GET  — estado do onboarding de primeiro login (nome + foto opcional).
 * POST — grava nome e foto em public.users + Storage; cliente deve chamar `update()` do NextAuth depois.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { needsProfileFirstLogin } from '../../../lib/profileDisplayName';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  const userId = session?.user?.supabaseId;
  if (!session?.user?.email || !userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return res.status(500).json({ error: 'Serviço indisponível' });
  }

  if (req.method === 'GET') {
    const email = session.user.email;
    const { data, error } = await supabase
      .from('users')
      .select('name, avatar_url, profile_first_login_completed_at, email')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[profile-first-login GET]', error.message);
      return res.status(500).json({ error: 'Não foi possível ler o perfil.' });
    }

    const needsOnboarding = needsProfileFirstLogin(data, email);
    return res.status(200).json({
      needsOnboarding,
      displayName: data?.name || '',
      avatarUrl: data?.avatar_url || null,
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { displayName, imageBase64, mimeType } = req.body || {};
  const name = String(displayName || '').trim();
  if (name.length < 1 || name.length > 120) {
    return res.status(400).json({ error: 'Informe seu nome (1–120 caracteres).' });
  }

  let avatar_url = null;
  if (imageBase64 && mimeType) {
    if (!/^image\/(jpeg|png|webp|gif)$/i.test(String(mimeType))) {
      return res.status(400).json({ error: 'Formato de imagem não suportado.' });
    }
    let buf;
    try {
      buf = Buffer.from(String(imageBase64), 'base64');
    } catch {
      return res.status(400).json({ error: 'Imagem inválida.' });
    }
    if (buf.length > MAX_IMAGE_BYTES) {
      return res.status(400).json({ error: 'Imagem muito grande (máx. 2 MB).' });
    }

    const mt = String(mimeType).toLowerCase();
    const ext = mt.includes('png') ? 'png' : mt.includes('webp') ? 'webp' : mt.includes('gif') ? 'gif' : 'jpg';
    const path = `${userId}/avatar.${ext}`;

    const { error: upErr } = await supabase.storage.from('avatars').upload(path, buf, {
      contentType: mt,
      upsert: true,
    });
    if (upErr) {
      console.error('[profile-first-login] storage upload:', upErr.message);
      return res.status(500).json({ error: 'Falha ao enviar a foto. Tente outra imagem.' });
    }

    const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
    avatar_url = pub?.publicUrl || null;
  }

  const patch = {
    name,
    profile_first_login_completed_at: new Date().toISOString(),
  };
  if (avatar_url) {
    patch.avatar_url = avatar_url;
  }

  const { error: dbErr } = await supabase.from('users').update(patch).eq('id', userId);
  if (dbErr) {
    console.error('[profile-first-login] users update:', dbErr.message);
    return res.status(500).json({ error: 'Não foi possível salvar o perfil.' });
  }

  const { data: rowOut } = await supabase
    .from('users')
    .select('name, avatar_url')
    .eq('id', userId)
    .maybeSingle();

  return res.status(200).json({
    ok: true,
    displayName: rowOut?.name || name,
    avatarUrl: rowOut?.avatar_url ?? avatar_url ?? null,
  });
}
