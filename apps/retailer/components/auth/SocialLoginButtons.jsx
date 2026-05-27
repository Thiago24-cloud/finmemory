import { signIn } from 'next-auth/react';
import { capturePosthog } from '../../lib/posthogClient';

/**
 * @param {{ providers: string[], callbackUrl: string, disabled?: boolean, variant?: 'light' | 'dark' }} props
 */
export function SocialLoginButtons({ providers = [], callbackUrl, disabled = false, variant = 'light' }) {
  const googleEnabled = providers.includes('google');
  const facebookEnabled = providers.includes('facebook');

  if (!googleEnabled && !facebookEnabled) return null;

  const dividerClass = variant === 'dark' ? 'text-white/40' : 'text-gray-500';
  const btnBase =
    variant === 'dark'
      ? 'w-full flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.04] py-3 text-sm font-semibold text-white hover:bg-white/[0.08] disabled:opacity-60 transition-colors'
      : 'w-full flex items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60 transition-colors';

  const onOAuth = (provider) => {
    capturePosthog('user_login_started', { method: provider });
    signIn(provider, { callbackUrl });
  };

  return (
    <div className="mb-4">
      {googleEnabled ? (
        <button type="button" disabled={disabled} onClick={() => onOAuth('google')} className={`${btnBase} mb-2`}>
          <GoogleIcon />
          Continuar com Google
        </button>
      ) : null}
      {facebookEnabled ? (
        <button type="button" disabled={disabled} onClick={() => onOAuth('facebook')} className={btnBase}>
          <FacebookIcon />
          Continuar com Facebook
        </button>
      ) : null}
      <p className={`text-xs text-center mt-3 mb-1 ${dividerClass}`}>ou use email e senha</p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.223 36 24 36c-5.522 0-10-4.478-10-10s4.478-10 10-10c2.523 0 4.817.943 6.564 2.473l6.066-6.066C33.436 9.045 28.991 7 24 7 13.507 7 5 15.507 5 26s8.507 19 19 19 19-8.507 19-19c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 13 24 13c2.523 0 4.817.943 6.564 2.473l6.066-6.066C33.436 9.045 28.991 7 24 7c-7.682 0-14.344 4.337-17.694 10.691z" />
      <path fill="#4CAF50" d="M24 45c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 36.091 26.715 37 24 37c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 45 24 45z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path fill="#1877F2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
    </svg>
  );
}
