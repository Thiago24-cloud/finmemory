const PASSWORD_MIN = 10;
const PASSWORD_MAX = 128;

export function validatePasswordStrength(password: string | null | undefined): {
  ok: boolean;
  message: string;
} {
  const pwd = String(password || '');
  if (pwd.length < PASSWORD_MIN || pwd.length > PASSWORD_MAX) {
    return {
      ok: false,
      message: `Senha deve ter entre ${PASSWORD_MIN} e ${PASSWORD_MAX} caracteres.`,
    };
  }
  if (!/[A-Z]/.test(pwd)) return { ok: false, message: 'Inclua pelo menos 1 letra maiuscula.' };
  if (!/[a-z]/.test(pwd)) return { ok: false, message: 'Inclua pelo menos 1 letra minuscula.' };
  if (!/\d/.test(pwd)) return { ok: false, message: 'Inclua pelo menos 1 numero.' };
  if (!/[^A-Za-z0-9]/.test(pwd)) return { ok: false, message: 'Inclua pelo menos 1 simbolo.' };
  return { ok: true, message: 'ok' };
}
