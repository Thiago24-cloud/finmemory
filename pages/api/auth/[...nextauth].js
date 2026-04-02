import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword } from '../../../lib/passwordAuth';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';
import { verifyTotpCode } from '../../../lib/tokens';
import { checkRateLimit, getRequestIp } from '../../../lib/rateLimit';
import { normalizeEmail } from '../../../lib/securityPolicy';

// Base padrão para OAuth/callback quando NEXTAUTH_URL não estiver definida.
// Para verificação do Google, mantenha alinhado com o domínio principal.
const DEFAULT_NEXTAUTH_URL = 'https://finmemory.com.br';
if (typeof process !== 'undefined') {
  const url = process.env.NEXTAUTH_URL || '';
  if (!url || !url.startsWith('http')) {
    process.env.NEXTAUTH_URL = DEFAULT_NEXTAUTH_URL;
  }
}

export const authOptions = {
  // Necessário atrás de proxy (Firebase Hosting → Cloud Run): NextAuth confia no host do proxy
  trustHost: true,
  // Credentials Provider funciona de forma estável com estratégia JWT.
  adapter: undefined,
  // Cookies: sem domain para link do Cloud Run; nomes sem __Host- para evitar CSRF falhar atrás de proxy.
  useSecureCookies: true,
  cookies: {
    sessionToken: {
      name: 'next-auth.session-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true }
    },
    callbackUrl: { options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true } },
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true }
    },
    state: { options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: 900 } }
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
        if (!ipRate.allowed) return null;

        const email = normalizeEmail(credentials?.email);
        const password = String(credentials?.password || '');
        const otp = String(credentials?.otp || '').trim();
        if (!email || !password) return null;

        const emailRate = checkRateLimit({ bucket: 'login-email', key: email, limit: 12, windowMs: 15 * 60 * 1000 });
        if (!emailRate.allowed) return null;

        const supabase = getSupabaseAdmin();
        if (!supabase) return null;

        const { data: localAuth, error: authErr } = await supabase
          .from('auth_local_users')
          .select('user_id,email,password_hash,email_verified_at,failed_login_attempts,lockout_until,totp_secret,totp_enabled_at')
          .eq('email', email)
          .maybeSingle();
        if (authErr || !localAuth?.password_hash) return null;

        const lockoutUntilTs = localAuth.lockout_until ? Date.parse(localAuth.lockout_until) : 0;
        if (lockoutUntilTs && lockoutUntilTs > Date.now()) return null;

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

        if (!localAuth.email_verified_at) {
          console.warn('[auth][login] email_not_verified', { email, ip });
          return null;
        }

        if (localAuth.totp_enabled_at && localAuth.totp_secret) {
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
        if (!userRow?.id) return null;

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
          const { data } = await supabase
            .from('users')
            .select('id, created_at')
            .eq('email', email)
            .maybeSingle();
          if (data?.id) {
            token.supabaseId = data.id;
            token.created_at = data.created_at;
          }
        } catch (e) {
          console.error('jwt callback users lookup:', e?.message || e);
        }
      }
      return token;
    },

    async signIn({ user, account }) {
      try {
        console.log('🔐 NextAuth SignIn callback –', user?.email, account?.provider);
        return true;
      } catch (err) {
        console.error('❌ SignIn callback exception (não bloqueia login):', err?.message || err);
        return true;
      }
    },
    
    async session({ session, user, token }) {
      if (user?.id) session.user.id = user.id;
      if (token) {
        if (token.supabaseId) session.user.supabaseId = token.supabaseId;
        if (token.created_at) session.user.created_at = token.created_at;
        if (token.sub && !session.user.id) session.user.id = token.sub;
      }
      if (session?.user?.email && !session.user.supabaseId) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            const { data } = await supabase
              .from('users')
              .select('id, created_at')
              .eq('email', session.user.email)
              .maybeSingle();
            if (data) {
              session.user.supabaseId = data.id;
              session.user.created_at = data.created_at;
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
