import { google } from 'googleapis';

export default async function handler(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.redirect('/dashboard?error=no_code');
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    console.log('✅ Autenticação realizada com sucesso!');
    console.log('Tokens:', tokens);
    
    // Por enquanto só redireciona
    // Depois vamos salvar os tokens no Supabase
    res.redirect('/dashboard?success=true');
  } catch (error) {
    console.error('❌ Erro no callback:', error);
    res.redirect('/dashboard?error=auth_failed');
  }
}