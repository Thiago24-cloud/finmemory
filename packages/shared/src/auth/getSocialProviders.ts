export type SocialProvider = 'google' | 'facebook';

/** Providers OAuth habilitados via variáveis de ambiente. */
export function getEnabledSocialProviders(): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push('google');
  }
  if (process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET) {
    providers.push('facebook');
  }
  return providers;
}
