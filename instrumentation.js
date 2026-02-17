/**
 * Next.js instrumentation – roda quando o servidor inicia.
 * Evita que unhandledRejection (ex.: "window is not defined" em código que roda no servidor) derrube o processo.
 */
export async function register() {
  if (typeof process === 'undefined') return;
  process.on('unhandledRejection', (reason) => {
    const msg = reason?.message ?? String(reason);
    console.warn('[instrumentation] unhandledRejection:', msg);
    if (msg.includes('window is not defined') || msg.includes('document is not defined')) {
      console.warn('[instrumentation] Provável acesso a window/document no servidor. Evitando crash.');
    }
  });
}
