import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Funções de validação inline para evitar problemas de import
function validateSupabase() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const results = [];
  let allValid = true;
  
  for (const name of required) {
    const valid = !!process.env[name];
    results.push({ 
      name, 
      valid, 
      message: valid ? `✅ ${name}` : `❌ ${name}`,
      description: `Variável ${name} necessária para Supabase`
    });
    if (!valid) allValid = false;
  }
  
  return { allValid, results };
}

function validateGoogleOAuth() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const results = [];
  let allValid = true;
  
  for (const name of required) {
    const valid = !!process.env[name];
    results.push({ 
      name, 
      valid, 
      message: valid ? `✅ ${name}` : `❌ ${name}`,
      description: `Variável ${name} necessária para Google OAuth`
    });
    if (!valid) allValid = false;
  }
  
  return { allValid, results };
}

// Validação das variáveis de ambiente no carregamento do módulo
const supabaseValidation = validateSupabase();
if (!supabaseValidation.allValid) {
  console.error('❌ ERRO CRÍTICO: Variáveis do Supabase não configuradas!');
  console.error('Configure: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY');
  supabaseValidation.results.forEach(r => {
    if (!r.valid) console.error(`  - ${r.name}: ${r.description}`);
  });
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req, res) {
  console.log('========================================');
  console.log('🔍 CALLBACK DEBUG - INÍCIO');
  console.log('========================================');
  
  // Validação de variáveis de ambiente
  const googleValidation = validateGoogleOAuth();
  if (!googleValidation.allValid) {
    console.error('❌ ERRO: Variáveis do Google OAuth não configuradas!');
    googleValidation.results.forEach(r => {
      if (!r.valid) console.error(`  - ${r.name}: ${r.description}`);
    });
    return res.redirect('/dashboard?error=config_error');
  }
  
  const supabaseValidation = validateSupabase();
  if (!supabaseValidation.allValid) {
    console.error('❌ ERRO: Variáveis do Supabase não configuradas!');
    supabaseValidation.results.forEach(r => {
      if (!r.valid) console.error(`  - ${r.name}: ${r.description}`);
    });
    return res.redirect('/dashboard?error=config_error');
  }
  
  try {
    const { code, state } = req.query;
    console.log('📝 Code recebido:', code?.substring(0, 20) + '...');
    console.log('🔒 State recebido:', state?.substring(0, 20) + '...');

    if (!code) {
      console.error('❌ Nenhum código OAuth recebido!');
      return res.redirect('/dashboard?error=no_code');
    }

    // 🔒 NOVO: Validar state token (proteção CSRF)
    const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    const savedState = cookies?.oauth_state;
    
    console.log('🔒 Validando state token...');
    console.log('- State da URL:', state);
    console.log('- State do cookie:', savedState?.substring(0, 20) + '...');
    
    if (!state || !savedState || state !== savedState) {
      console.error('❌ State token inválido! Possível ataque CSRF.');
      return res.redirect('/dashboard?error=invalid_state');
    }
    
    console.log('✅ State token válido!');
    
    // 🔒 NOVO: Limpar cookie do state após validação
    res.setHeader('Set-Cookie', 'oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');

    console.log('🔑 Criando OAuth2Client...');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    console.log('🔄 Trocando código por tokens...');
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ Tokens recebidos');
    console.log('Token expiry:', new Date(tokens.expiry_date));
    
    console.log('👤 Buscando informações do usuário...');
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    
    console.log('✅ Usuário obtido:');
    console.log('- Email:', userInfo.data.email);
    console.log('- Name:', userInfo.data.name);
    console.log('- Google ID:', userInfo.data.id);

    console.log('💾 Verificando conexão Supabase...');
    console.log('- URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log('- Service Key existe:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);

    console.log('💾 Salvando no Supabase...');
    const userData = {
      email: userInfo.data.email,
      name: userInfo.data.name,
      google_id: userInfo.data.id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: new Date(tokens.expiry_date),
      last_sync: new Date()
    };
    
    console.log('Dados a serem salvos:', JSON.stringify(userData, null, 2));

    const { data, error } = await supabase
      .from('users')
      .upsert(userData, {
        onConflict: 'email'
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Erro ao salvar no Supabase:');
      console.error('- Code:', error.code);
      console.error('- Message:', error.message);
      console.error('- Details:', error.details);
      console.error('- Hint:', error.hint);
      return res.redirect('/dashboard?error=save_failed&details=' + error.message);
    }

    console.log('✅ Usuário salvo com sucesso!');
    console.log('- ID:', data.id);
    console.log('- Email:', data.email);
    
    console.log('🚀 Redirecionando para dashboard...');
    console.log('========================================');

    res.redirect('/dashboard?success=true&user_id=' + data.id);

  } catch (error) {
    console.error('========================================');
    console.error('❌ ERRO NO CALLBACK:');
    console.error('- Name:', error.name);
    console.error('- Message:', error.message);
    console.error('- Stack:', error.stack);
    console.error('========================================');
    
    res.redirect('/dashboard?error=auth_failed&message=' + encodeURIComponent(error.message));
  }
}
