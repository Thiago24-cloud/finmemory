import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
  const { code } = req.query; // O código que o Google enviou na URL

  if (!code) {
    return res.status(400).json({ error: 'Código não fornecido pelo Google' });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    `https://${process.env.VERCEL_URL}/api/auth/callback/google`
  );

  try {
    // 1. Troca o código pelos Tokens (Access Token e Refresh Token)
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // 2. Pega o e-mail do usuário para saber de quem é a conta
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userinfo = await oauth2.userinfo.get();
    const userEmail = userinfo.data.email;

    // 3. Salva o Refresh Token no Supabase
    // IMPORTANTE: A tabela 'user_connections' precisa existir no seu Supabase!
    const { error } = await supabase
      .from('user_connections')
      .upsert({ 
        email_usuario: userEmail,
        refresh_token: tokens.refresh_token,
        provider: 'google'
      }, { onConflict: 'email_usuario' });

    if (error) throw error;

    // 4. Tudo certo! Manda o usuário de volta para o Dashboard
    res.redirect('/?success=true');

  } catch (error) {
    console.error('Erro no callback do Google:', error);
    res.redirect('/?error=auth_failed');
  }
}