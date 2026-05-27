/**
 * Códigos curtos transmitidos pelo NextAuth no query ?error= (fluxo credentials com json:true).
 * Não exponham estados ambíguos (ex.: e-mail inexiste vs senha errada) — ficam como CredentialsSignin (retorno null).
 */
export const FINMEMORY_CREDENTIAL_ERROR = Object.freeze({
  VERIFY_EMAIL: 'FmVerifyEmail',
  ACCOUNT_LOCKED: 'FmAccountLocked',
  REQUIRES_OTP: 'FmRequiresOtp',
  INVALID_OTP: 'FmInvalidOtp',
});

export function credentialLoginRejected(code) {
  const err = new Error(code);
  err.name = 'CredentialsSignin';
  throw err;
}
