export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Nunca interceptar APIs do NextAuth ou APIs em geral.
    // Isso evita o erro 1101 no login Google.
    if (path.startsWith('/api/auth/') || path.startsWith('/api/')) {
      return fetch(request);
    }

    // Para demais rotas, mantém comportamento padrão (proxy para origin).
    return fetch(request);
  },
};

