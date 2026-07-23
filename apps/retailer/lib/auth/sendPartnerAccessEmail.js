import { sendSecurityEmail } from '../securityEmail';
import { getRetailerPublicBaseUrl } from './getRetailerPublicBaseUrl';

/**
 * E-mail de primeiro acesso: link do painel + e-mail + senha.
 */
export async function sendPartnerAccessCredentialsEmail({
  to,
  name,
  password,
  storeName,
  subject,
}) {
  const base = getRetailerPublicBaseUrl();
  const painelPath = '/parceiros/painel';
  const loginUrl = `${base}/login?callbackUrl=${encodeURIComponent(painelPath)}`;
  const displayName = String(name || '').trim() || 'parceiro';
  const storeLine = storeName
    ? `<p>Loja: <strong>${escapeHtml(storeName)}</strong></p>`
    : '';

  return sendSecurityEmail({
    to,
    subject: subject || 'Seu acesso ao FinMemory Parceiros',
    html: `<p>Olá, ${escapeHtml(displayName)}!</p>
      <p>Seu acesso ao painel da loja está pronto.</p>
      ${storeLine}
      <p><strong>Link de entrada:</strong><br/><a href="${loginUrl}">${loginUrl}</a></p>
      <p><strong>E-mail:</strong> ${escapeHtml(to)}<br/>
      <strong>Senha:</strong> ${escapeHtml(password)}</p>
      <p>Guarde estes dados. Você pode alterar a senha depois em “Esqueci a senha” na tela de login.</p>`,
    fallbackLog: `partner_access=${to}; login=${loginUrl}; password=${password}`,
  });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
