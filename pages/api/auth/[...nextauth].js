import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';

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
    
    async jwt({ token, account, user }) {
      // Persist the OAuth access_token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.provider = account.provider;
      }
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    
    async session({ session, token }) {
      // Send properties to the client
      session.accessToken = token.accessToken;
      session.user.id = token.userId;
      
      // Get the Supabase user ID
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
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },
  
  // IMPORTANTE: Secret obrigatório para produção
  secret: process.env.NEXTAUTH_SECRET,

  // Em produção: defina NEXTAUTH_DEBUG=1 no Cloud Run para ver o erro real do callback
  debug: process.env.NODE_ENV === 'development' || process.env.NEXTAUTH_DEBUG === '1'
};

export default NextAuth(authOptions);
