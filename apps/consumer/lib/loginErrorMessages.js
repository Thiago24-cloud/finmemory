import { FINMEMORY_CREDENTIAL_ERROR } from './finmemoryLoginErrorCodes';

/** Mensagens em PT para a tela /login quando signIn(..., { redirect: false }). */
export function messageForCredentialLogin(nextAuthError, { otpFieldVisible } = {}) {
  const custom = FINMEMORY_CREDENTIAL_ERROR;
  switch (nextAuthError) {
    case custom.VERIFY_EMAIL:
      return EXTRA[custom.VERIFY_EMAIL];
    case custom.ACCOUNT_LOCKED:
      return EXTRA[custom.ACCOUNT_LOCKED];
    case custom.REQUIRES_OTP:
      return EXTRA[custom.REQUIRES_OTP];
    case custom.INVALID_OTP:
      return otpFieldVisible ? EXTRA.INVALID_OTP_SHOWN : EXTRA.INVALID_OTP_HIDDEN;
    case 'AccessDenied':
      return EXTRA.AccessDenied;
    case 'CredentialsSignin':
    default:
      return otpFieldVisible ? EXTRA.CredentialsSigninWith2fa : EXTRA.CredentialsSignin;
  }
}

const EXTRA = Object.freeze({
  AccessDenied:
    'Acesso ainda não liberado para seu email nesta fase do FinMemory. Se acredita que é um erro, fale com o suporte.',
  CredentialsSignin: 'Nao foi possivel entrar. Verifique email e senha.',
  CredentialsSigninWith2fa: 'Nao foi possivel entrar. Verifique email, senha e codigo 2FA.',
  [FINMEMORY_CREDENTIAL_ERROR.VERIFY_EMAIL]:
    'Confirme seu email antes de entrar. Verifique a caixa de entrada ou use Reenviar confirmação.',
  [FINMEMORY_CREDENTIAL_ERROR.ACCOUNT_LOCKED]:
    'Conta temporariamente bloqueada após várias tentativas. Tente de novo em cerca de 15 minutos.',
  [FINMEMORY_CREDENTIAL_ERROR.REQUIRES_OTP]:
    'Esta conta usa 2FA. Toque em "Conta com 2FA?", informe o código de 6 dígitos e tente entrar novamente.',
  INVALID_OTP_HIDDEN:
    'Nao foi possivel entrar. Se sua conta usa 2FA, toque para informar o código de 6 dígitos.',
  INVALID_OTP_SHOWN: 'Codigo 2FA incorreto ou expirado. Tente de novo.',
});
