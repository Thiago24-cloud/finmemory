import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeEmail } from '../validation/email';

export type EnsureOAuthUserParams = {
  email: string;
  name?: string;
  image?: string;
  provider?: string;
  providerAccountId?: string;
};

export type EnsureOAuthUserResult = {
  id: string;
  email: string;
  name: string;
  isNew: boolean;
};

/**
 * Cria ou atualiza public.users após login OAuth (Google/Facebook).
 */
export async function ensureOAuthUser(
  supabase: SupabaseClient,
  { email, name, image, provider, providerAccountId }: EnsureOAuthUserParams
): Promise<EnsureOAuthUserResult> {
  if (!supabase) throw new Error('Supabase indisponível');
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error('Email inválido');

  const safeName = String(name || normalized.split('@')[0] || 'Usuário').slice(0, 120);
  const avatarUrl = image ? String(image).slice(0, 2048) : null;
  const providerId = providerAccountId ? String(providerAccountId).slice(0, 128) : null;

  const { data: existing, error: lookupErr } = await supabase
    .from('users')
    .select('id, email, name, google_id, avatar_url')
    .eq('email', normalized)
    .maybeSingle();

  if (lookupErr) {
    console.error('[ensureOAuthUser] lookup:', lookupErr.message);
    throw new Error('Não foi possível localizar a conta');
  }

  if (existing?.id) {
    const patch: Record<string, string> = { last_sync: new Date().toISOString() };
    if (safeName && (!existing.name || existing.name === existing.email)) patch.name = safeName;
    if (avatarUrl) patch.avatar_url = avatarUrl;
    if (provider === 'google' && providerId) patch.google_id = providerId;

    if (Object.keys(patch).length > 1) {
      const { error: updErr } = await supabase.from('users').update(patch).eq('id', existing.id);
      if (updErr) console.warn('[ensureOAuthUser] update:', updErr.message);
    }

    return {
      id: existing.id,
      email: existing.email,
      name: patch.name || existing.name || safeName,
      isNew: false,
    };
  }

  const insert = {
    email: normalized,
    name: safeName,
    google_id: provider === 'google' && providerId ? providerId : null,
    avatar_url: avatarUrl,
    access_token: null,
    refresh_token: null,
    token_expiry: null,
    last_sync: new Date(),
  };

  const { data: created, error: insertErr } = await supabase
    .from('users')
    .insert(insert)
    .select('id, email, name')
    .single();

  if (insertErr || !created?.id) {
    console.error('[ensureOAuthUser] insert:', insertErr?.message);
    throw new Error('Não foi possível criar a conta');
  }

  return {
    id: created.id,
    email: created.email,
    name: created.name || safeName,
    isNew: true,
  };
}
