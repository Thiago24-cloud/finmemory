/**
 * Redireciona /auth/callback para o callback correto do NextAuth.
 * Alguns clientes (ex.: app mobile) podem apontar para /auth/callback em vez de /api/auth/callback/google.
 */
export async function getServerSideProps({ res, query }) {
  const qs = new URLSearchParams(query).toString();
  const dest = qs ? `/api/auth/callback/google?${qs}` : '/api/auth/callback/google';
  res.writeHead(302, { Location: dest });
  res.end();
  return { props: {} };
}

export default function AuthCallbackRedirect() {
  return null;
}
