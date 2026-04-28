import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword, isScryptPasswordHash } from '../../../lib/passwordAuth';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyTotpCode } from '../../../lib/tokens';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { normalizeEmail } from '../../../lib/securityPolicy';
import { getPrivateBetaAllowlistFromEnv, isEmailAllowedInPrivateBeta } from '../../../lib/privateBetaAllowlist';

const DEFAULT_GOOGLE_PLAY_REVIEWER_EMAILS = ['thiagochimzie4@gmail.com', 'thiagochimezie44@gmail.com'];

function getGooglePlayReviewerEmails() {
  const envEmails = String(process.env.GOOGLE_PLAY_REVIEWER_EMAILS || '')
    .split(',')
    .map((item) => normalizeEmail(item))
    .filter(Boolean);
  const normalizedDefaults = DEFAULT_GOOGLE_PLAY_REVIEWER_EMAILS.map((item) => normalizeEmail(item)).filter(Boolean);
  return new Set([...normalizedDefaults, ...envEmails]);
}

function isGooglePlayReviewerEmail(email) {
  return getGooglePlayReviewerEmails().has(normalizeEmail(email));
}

// Base padrão para OAuth/callback quando NEXTAUTH_URL não estiver definida.
const DEFAULT_NEXTAUTH_URL = 'https://finmemory.com.br';
if (typeof process !== 'undefined') {
  const url = process.env.NEXTAUTH_URL || '';
  if (!url || !url.startsWith('http')) {
    process.env.NEXTAUTH_URL = DEFAULT_NEXTAUTH_URL;
  }
}

// Cookies seguros (secure:true) só funcionam em HTTPS.
// Em localhost (http) devem ser false para o browser armazenar CSRF + sessão.
const _isHttps = (process.env.NEXTAUTH_URL || '').startsWith('https://');

export const authOptions = {
  // Necessário atrás de proxy (Firebase Hosting → Cloud Run): NextAuth confia no host do proxy
  trustHost: true,
  // Credentials Provider funciona de forma estável com estratégia JWT.
  adapter: undefined,
  // Cookies: sem domain para link do Cloud Run; nomes sem __Host- para evitar CSRF falhar atrás de proxy.
  // secure ativo só em HTTPS — em http://localhost o browser recusa cookies secure e o CSRF quebra.
  useSecureCookies: _isHttps,
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: _isHttps }
    },
    callbackUrl: { options: { httpOnly: true, sameSite: 'lax', path: '/', secure: _isHttps } },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: _isHttps }
    },
    state: { options: { httpOnly: true, sameSite: 'lax', path: '/', secure: _isHttps, maxAge: 900 } }
  },
  providers: [
    CredentialsProvider({
      name: 'Email e senha',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
        otp: { label: 'Codigo 2FA', type: 'text' },
      },
      async authorize(credentials, req) {
        const ip = getRequestIp(req);
        const ipRate = checkRateLimit({ bucket: 'login-ip', key: ip, limit: 20, windowMs: 15 * 60 * 1000 });
        if (!ipRate.allowed) {
          console.warn('[auth][login] reject', { code: 'rate_limit_ip', ip });
          return null;
        }

        const email = normalizeEmail(credentials?.email);
        const isReviewer = isGooglePlayReviewerEmail(email);
        const password = String(credentials?.password || '');
        const otp = String(credentials?.otp || '').trim();
        if (!email || !password) {
          console.warn('[auth][login] reject', { code: 'missing_email_or_password', ip });
          return null;
        }

        const emailRate = checkRateLimit({ bucket: 'login-email', key: email, limit: 12, windowMs: 15 * 60 * 1000 });
        if (!emailRate.allowed) {
          console.warn('[auth][login] reject', { code: 'rate_limit_email', email, ip });
          return null;
        }

        const supabase = getSupabaseAdmin();
        if (!supabase) {
          console.warn('[auth][login] reject', { code: 'supabase_admin_missing', ip });
          return null;
        }

        const { data: localAuth, error: authErr } = await supabase
          .from('auth_local_users')
          .select('user_id,email,password_hash,email_verified_at,failed_login_attempts,lockout_until,totp_secret,totp_enabled_at')
          .eq('email', email)
          .maybeSingle();
        if (authErr) {
          console.warn('[auth][login] reject', {
            code: 'auth_local_users_query_error',
            email,
            ip,
            message: authErr.message,
            details: authErr.details,
            hint: authErr.hint,
            code_db: authErr.code,
          });
          return null;
        }
        if (!localAuth) {
          console.warn('[auth][login] reject', { code: 'no_auth_local_user_row', email, ip });
          return null;
        }
        if (!localAuth.password_hash) {
          console.warn('[auth][login] reject', { code: 'no_password_hash', email, ip });
          return null;
        }

        if (!isScryptPasswordHash(localAuth.password_hash)) {
          console.error(
            '[auth][login] password_hash_format_invalid — esperado scrypt$N$r$p$salt$hash (use hashPassword() ou fluxo de reset).'
          );
          return null;
        }

        const lockoutUntilTs = localAuth.lockout_until ? Date.parse(localAuth.lockout_until) : 0;
        if (lockoutUntilTs && lockoutUntilTs > Date.now()) {
          console.warn('[auth][login] reject', { code: 'account_locked', email, ip, lockout_until: localAuth.lockout_until });
          return null;
        }

        if (!verifyPassword(password, localAuth.password_hash)) {
          const attempts = Number(localAuth.failed_login_attempts || 0) + 1;
          const shouldLock = attempts >= 5;
          await supabase
            .from('auth_local_users')
            .update({
              failed_login_attempts: attempts,
              lockout_until: shouldLock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq('email', email);
          console.warn('[auth][login] invalid_password', { email, ip, attempts });
          return null;
        }

        if (!localAuth.email_verified_at && !isReviewer) {
          console.warn('[auth][login] email_not_verified', { email, ip });
          return null;
        }

        if (!isReviewer && localAuth.totp_enabled_at && localAuth.totp_secret) {
          const validOtp = verifyTotpCode({ secret: localAuth.totp_secret, code: otp, window: 1 });
          if (!validOtp) {
            console.warn('[auth][login] invalid_otp', { email, ip });
            return null;
          }
        }

        await supabase
          .from('auth_local_users')
          .update({
            failed_login_attempts: 0,
            lockout_until: null,
            last_login_ip: ip,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('email', email);

        const { data: userRow } = await supabase
          .from('users')
          .select('id,email,name,created_at')
          .eq('id', localAuth.user_id)
          .maybeSingle();
        if (!userRow?.id) {
          console.error('[auth][login] missing_users_row_for_user_id', { email, user_id: localAuth.user_id });
          return null;
        }

        return {
          id: userRow.id,
          email: userRow.email,
          name: userRow.name || userRow.email,
          supabaseId: userRow.id,
          created_at: userRow.created_at,
        };
      },
    }),
  ],
  
  callbacks: {
    // Evita TypeError: Invalid URL quando o cookie callbackUrl contém token/corrompido (NextAuth chama new URL(url) no default)
    redirect({ url, baseUrl }) {
      if (!url || typeof url !== 'string') return baseUrl;
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.origin === new URL(baseUrl).origin) return url;
      } catch (_) {
        // url era token ou valor inválido (ex.: cookie errado) — ignora e usa baseUrl
      }
      return baseUrl;
    },
    async jwt({ token, user }) {
      const email = user?.email || token.email;
      if (email) token.email = email;
      const supabase = getSupabaseAdmin();
      if (email && supabase) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('id, created_at, plano, plano_ativo')
            .eq('email', email)
            .maybeSingle();
          if (data?.id) {
            token.supabaseId = data.id;
            token.created_at = data.created_at;
            token.plano = data.plano || 'free';
            token.plano_ativo = Boolean(data.plano_ativo);
          } else if (error) {
            // plano/plano_ativo columns may not exist yet — fallback to basic query
            console.warn('jwt callback: extended query failed, trying fallback:', error?.message);
            const { data: basic } = await supabase
              .from('users')
              .select('id, created_at')
              .eq('email', email)
              .maybeSingle();
            if (basic?.id) {
              token.supabaseId = basic.id;
              token.created_at = basic.created_at;
              token.plano = 'free';
              token.plano_ativo = false;
            }
          }
        } catch (e) {
          console.error('jwt callback users lookup:', e?.message || e);
        }
      }
      return token;
    },

    async signIn({ user }) {
      try {
        if (isGooglePlayReviewerEmail(user?.email)) {
          return true;
        }
        const allowlist = getPrivateBetaAllowlistFromEnv();
        if (!isEmailAllowedInPrivateBeta(user?.email, allowlist)) {
          console.warn('[auth] signIn bloqueado (lista de acesso):', user?.email);
          return false;
        }
        console.log('🔐 NextAuth SignIn callback –', user?.email);
        return true;
      } catch (err) {
        console.error('❌ SignIn callback exception:', err?.message || err);
        return false;
      }
    },
    
    async session({ session, user, token }) {
      if (user?.id) session.user.id = user.id;
      if (token) {
        if (token.supabaseId) session.user.supabaseId = token.supabaseId;
        if (token.created_at) session.user.created_at = token.created_at;
        if (token.sub && !session.user.id) session.user.id = token.sub;
        session.user.plano = token.plano || 'free';
        session.user.plano_ativo = Boolean(token.plano_ativo);
      }
      if (session?.user?.email && !session.user.supabaseId) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            const { data, error } = await supabase
              .from('users')
              .select('id, created_at, plano, plano_ativo')
              .eq('email', session.user.email)
              .maybeSingle();
            if (data) {
              session.user.supabaseId = data.id;
              session.user.created_at = data.created_at;
              session.user.plano = data.plano || 'free';
              session.user.plano_ativo = Boolean(data.plano_ativo);
            } else if (error) {
              console.warn('session callback: extended query failed, trying fallback:', error?.message);
              const { data: basic } = await supabase
                .from('users')
                .select('id, created_at')
                .eq('email', session.user.email)
                .maybeSingle();
              if (basic) {
                session.user.supabaseId = basic.id;
                session.user.created_at = basic.created_at;
                session.user.plano = 'free';
                session.user.plano_ativo = false;
              }
            }
          }
        } catch (error) {
          console.error('Error fetching Supabase user:', error);
        }
      }
      return session;
    }
  },
  
  events: {
    async error({ message, error }) {
      // Log completo para diagnosticar OAUTH_CALLBACK_ERROR no Cloud Run
      console.error('[next-auth][OAUTH_ERROR]', message);
      if (error) console.error('[next-auth][OAUTH_ERROR] detail:', error?.message ?? error);
      if (error?.stack) console.error('[next-auth][OAUTH_ERROR] stack:', error.stack);
    }
  },

  pages: {
    signIn: '/login',
    error: '/auth-error'
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  
  // IMPORTANTE: Secret obrigatório para produção
  secret: process.env.NEXTAUTH_SECRET,

  // Em produção: defina NEXTAUTH_DEBUG=1 no Cloud Run para ver o erro real do callback
  debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === '1'
};

const nextAuthHandler = NextAuth(authOptions);

export default async function handler(req, res) {
  try {
    return await nextAuthHandler(req, res);
  } catch (err) {
    const isInvalidUrl = err instanceof TypeError && err?.message?.includes?.('Invalid URL');
    if (isInvalidUrl) {
      console.error('[next-auth] Invalid URL caught, redirecting to error page:', err?.message);
      res.redirect(302, '/auth-error?error=Configuration');
      return;
    }
    throw err;
  }
}
