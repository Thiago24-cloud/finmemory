/**
 * Next.js instrumentation – roda quando o servidor inicia (Node).
 * Também é avaliado no contexto Edge (middleware): aí não existe process.on — não registar listeners.
 */
export async function register() {
  if (typeof process === 'undefined' || typeof process.on !== 'function') return;
  process.on('unhandledRejection', (reason) => {
    const msg = reason?.message ?? String(reason);
    console.warn('[instrumentation] unhandledRejection:', msg);
    if (msg.includes('window is not defined') || msg.includes('document is not defined')) {
      console.warn('[instrumentation] Provável acesso a window/document no servidor. Evitando crash.');
    }
  });
}
