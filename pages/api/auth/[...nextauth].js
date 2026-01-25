import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { createClient } from '@supabase/supabase-js';

// Supabase client for storing user data
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly'
        }
      }
    })
  ],
  
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('========================================');
      console.log('🔐 NextAuth SignIn Callback');
      console.log('========================================');
      console.log('User:', user.email);
      console.log('Provider:', account.provider);
      
      try {
        // Save user to Supabase
        const userData = {
          email: user.email,
          name: user.name,
          google_id: profile.sub || user.id,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          token_expiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
          last_sync: new Date()
        };
        
        console.log('💾 Saving user to Supabase...');
        
        const { data, error } = await supabase
          .from('users')
          .upsert(userData, { onConflict: 'email' })
          .select()
          .single();
        
        if (error) {
          console.error('❌ Supabase error:', error);
          // Don't block sign in if Supabase fails
        } else {
          console.log('✅ User saved:', data.id);
        }
        
        return true;
      } catch (error) {
        console.error('❌ SignIn callback error:', error);
        return true; // Still allow sign in
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
        const { data } = await supabase
          .from('users')
          .select('id')
          .eq('email', session.user.email)
          .single();
        
        if (data) {
          session.user.supabaseId = data.id;
        }
      } catch (error) {
        console.error('Error fetching Supabase user:', error);
      }
      
      return session;
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
  
  debug: process.env.NODE_ENV === 'development'
};

export default NextAuth(authOptions);
