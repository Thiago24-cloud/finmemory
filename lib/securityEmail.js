const FROM = process.env.AUTH_EMAIL_FROM || 'FinMemory <no-reply@finmemory.com.br>';

async function sendViaResend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
    }),
  });
  return res.ok;
}

export async function sendSecurityEmail({ to, subject, html, fallbackLog }) {
  try {
    const sent = await sendViaResend({ to, subject, html });
    if (sent) return true;
  } catch (err) {
    console.error('[security-email] send error:', err?.message || err);
  }
  // Sem RESEND_API_KEY: imprime o link no console para uso manual em dev.
  console.warn(
    '\n========== [security-email] EMAIL NÃO ENVIADO — copie o link abaixo ==========\n' +
    `Para: ${to}\nAssunto: ${subject}\n${fallbackLog}\n` +
    '================================================================================\n'
  );
  return false;
}
