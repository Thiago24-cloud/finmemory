import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { SupabaseAdapter } from '@next-auth/supabase-adapter';
import { createClient } from '@supabase/supabase-js';

// Em produção com uma única URL (só Cloud Run): forçar sempre esta base (evita Invalid URL quando a env está antiga/errada)
const DEFAULT_NEXTAUTH_URL = 'https://finmemory-836908221936.southamerica-east1.run.app';
if (typeof process !== 'undefined') {
  const url = process.env.NEXTAUTH_URL || '';
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction || !url || !url.startsWith('http')) {
    process.env.NEXTAUTH_URL = DEFAULT_NEXTAUTH_URL;
  }
}

// Lazy initialization do Supabase - só cria quando realmente necessário
let supabaseInstance = null;
let supabaseConfigWarned = false;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      if (!supabaseConfigWarned) {
        supabaseConfigWarned = true;
        console.warn('⚠️ Variáveis do Supabase não configuradas no servidor. Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Cloud Run. Ver DEPLOY-CLOUD-RUN.md');
      }
      return null;
    }
    
    supabaseInstance = createClient(url, key);
  }
  return supabaseInstance;
}

export const authOptions = {
  // Necessário atrás de proxy (Firebase Hosting → Cloud Run): NextAuth confia no host do proxy
  trustHost: true,
  // Só cria o adapter quando as env existem (no build do Cloud Build não há SUPABASE_SERVICE_ROLE_KEY)
  adapter:
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
      ? SupabaseAdapter({
          url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          secret: process.env.SUPABASE_SERVICE_ROLE_KEY,
        })
      : undefined,
  // Permite vincular conta Google a usuário já existente com mesmo email (ex.: usuário criado quando linkAccount falhou por coluna faltando)
  allowDangerousEmailAccountLinking: true,
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
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent', // força tela de consentimento para pedir permissão de e-mail
          access_type: 'offline',
          response_type: 'code',
          // Permissão para LER e-mails do Gmail (obrigatório no Google Cloud Console)
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly'
        }
      }
    })
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
    async signIn({ user, account, profile }) {
      try {
        console.log('🔐 NextAuth SignIn callback –', user?.email, account?.provider);
        const supabase = getSupabase();
        if (!supabase) {
          console.warn('⚠️ Supabase não disponível, pulando salvamento do usuário');
          return true;
        }
        const userData = {
          email: user.email,
          name: user.name,
          google_id: (profile && profile.sub) || user.id,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          token_expiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
          last_sync: new Date()
        };
        const { data, error } = await supabase
          .from('users')
          .upsert(userData, { onConflict: 'email' })
          .select()
          .single();
        if (error) {
          console.error('❌ Supabase upsert (não bloqueia login):', error.message, error.code);
        } else {
          console.log('✅ User saved:', data?.id);
        }
        return true;
      } catch (err) {
        console.error('❌ SignIn callback exception (não bloqueia login):', err?.message || err);
        return true;
      }
    },
    
    async session({ session, user }) {
      // strategy: 'database' — user vem do adapter (em fluxo de erro user pode ser undefined)
      if (user?.id) {
        session.user.id = user.id;
      }
      // Dados da nossa tabela customizada `users` (id, created_at) para compatibilidade
      if (session?.user?.email) {
        try {
          const supabase = getSupabase();
          if (supabase) {
            const { data } = await supabase
              .from('users')
              .select('id, created_at')
              .eq('email', session.user.email)
              .single();
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
    signIn: '/',
    error: '/auth-error'
  },

  session: {
    strategy: 'database',
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
