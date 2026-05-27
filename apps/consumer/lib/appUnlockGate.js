/**
 * Desbloqueio após sessão NextAuth resolvida (antes de esconder a splash).
 * Web: sem passo extra. Capacitor: ponto único para integrar biometria / PIN nativo.
 *
 * Regra de produto sugerida (quando implementar biometria):
 * - Exigir após cold start ou após X min em background; não a cada blur de aba no browser.
 */
export async function requireAppUnlockAfterSession() {
  if (typeof window === 'undefined') return;

  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    // Reservado: ex. @capgo/capacitor-native-biometric ou LocalAuthentication bridge.
  } catch {
    /* @capacitor/core ausente em alguns ambientes de teste */
  }
}
