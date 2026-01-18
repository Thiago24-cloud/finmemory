import { google } from 'googleapis';
import crypto from 'node:crypto';

// Função para validar variáveis do Google OAuth
function validateGoogleOAuth() {
  const required = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI'];
  const results = [];
  let allValid = true;
  
  for (const name of required) {
    const valid = !!process.env[name];
    results.push({ 
      name, 
      valid, 
      message: valid ? `✅ ${name} configurada` : `❌ ${name} não configurada` 
    });
    if (!valid) allValid = false;
  }
  
  return { allValid, results };
}

export default async function handler(req, res) {
  console.log('========================================');
  console.log('🔍 GOOGLE OAUTH DEBUG - INÍCIO');
  console.log('========================================');
  
  console.log('📋 Verificando variáveis de ambiente:');
  console.log('CLIENT_ID exists:', !!process.env.GOOGLE_CLIENT_ID);
  console.log('CLIENT_ID:', process.env.GOOGLE_CLIENT_ID?.substring(0, 30) + '...');
  console.log('CLIENT_SECRET exists:', !!process.env.GOOGLE_CLIENT_SECRET);
  console.log('CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET?.substring(0, 15) + '...');
  console.log('REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);  
  
  // Validação de variáveis de ambiente
  const googleValidation = validateGoogleOAuth();
  if (!googleValidation.allValid) {
    console.error('❌ ERRO: Variáveis de ambiente do Google não configuradas!');
    googleValidation.results.forEach(r => {
      if (!r.valid) console.error(`  - ${r.name}: ${r.description}`);
    });
    const missing = googleValidation.results.filter(r => !r.valid).map(r => r.name);
    return res.status(500).json({ 
      error: 'Configuração do servidor incompleta',
      message: 'Variáveis de ambiente do Google OAuth não configuradas. Contate o administrador.',
      missing: missing
    });
  }  
  
  try {
    // 🔒 NOVO: Gerar state token para segurança CSRF
    const state = crypto.randomBytes(32).toString('hex');
    
    // 🔒 NOVO: Salvar state em cookie seguro
    res.setHeader('Set-Cookie', `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`);
    
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    console.log('✅ OAuth2Client criado com sucesso');
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/userinfo.email',
        'https://www.googleapis.com/auth/userinfo.profile'
      ],
      prompt: 'consent',
      state: state  // 🔒 NOVO: Adicionar state na URL
    });
    
    console.log('✅ Auth URL gerada com state:', authUrl.substring(0, 80) + '...');
    console.log('🔒 State token gerado e salvo em cookie');
    console.log('🚀 Redirecionando para Google...');
    console.log('========================================');
    
    res.redirect(authUrl);
  } catch (error) {
    console.error('========================================');
    console.error('❌ ERRO COMPLETO:');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    console.error('========================================');
    
    res.status(500).json({ 
      error: 'Erro ao iniciar autenticação',
      details: error.message 
    });
  }
}