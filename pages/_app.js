import { Component, useEffect, useRef } from 'react';
import { SessionProvider, useSession } from 'next-auth/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Toaster } from 'sonner';
import { useRouter } from 'next/router';
import posthog from 'posthog-js';
import { PostHogProvider } from 'posthog-js/react';
import AnalyticsProvider from '../components/AnalyticsProvider';
import ClientOnly from '../components/ClientOnly';
import ErrorBoundary from '../components/ErrorBoundary';
import { AppSplashGate } from '../components/splash/AppSplashGate';
import { DeployRecovery } from '../components/DeployRecovery';
import PWAInstallProvider from '../components/PWAInstallProvider';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import { MapCartProvider } from '../components/map/MapCartContext';
import { MissionsTodayProvider } from '../components/missions/MissionsTodayContext';
import { ProfileFirstLoginGate } from '../components/onboarding/ProfileFirstLoginGate';
import { AccountTypeGate } from '../components/onboarding/AccountTypeGate';
import { RecoveryIdentifierGate } from '../components/onboarding/RecoveryIdentifierGate';
import { WelcomeBackGate } from '../components/gamification/WelcomeBackGate';
import { UserRoleProvider } from '../contexts/UserRoleContext';
import { OnboardingTourProvider } from '../contexts/OnboardingTourContext';
import { OnboardingGuideGate } from '../components/onboarding/OnboardingGuideGate';
import { FeatureUsageRecorder } from '../components/onboarding/FeatureUsageRecorder';
import AppMainBottomNav from '../components/AppMainBottomNav';
import PageTransitionLayout from '../components/PageTransitionLayout';
import { GA_MEASUREMENT_ID, isGaAllowedHost } from '../lib/analytics';
import { capturePosthog, hasPosthogProjectKey } from '../lib/posthogClient';
import { isMerchantPanelPage, isPublicMarketingPage } from '../lib/marketingRoutes';
import '../styles/globals.css';

if (typeof window !== 'undefined' && hasPosthogProjectKey()) {
  try {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
      // Tráfego via reverse proxy em `next.config.ts` (`/ingest` → PostHog Cloud).
      api_host: `${window.location.origin}/ingest`,
      capture_pageview: false,
      capture_pageleave: true,
    });
  } catch (e) {
    console.warn('[posthog] init failed:', e?.message || e);
  }
}

/**
 * Só carrega o script do GA em hosts permitidos (produção),
 * para não poluir métricas com localhost, previews, etc.
 */
class SafeGoogleAnalytics extends Component {
  state = { hasError: false, hostChecked: false, hostAllowed: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err, info) {
    console.warn('GoogleAnalytics error (ignored):', err?.message || err, info);
  }
  componentDidMount() {
    const hostAllowed =
      typeof window !== 'undefined' && isGaAllowedHost(window.location.hostname);
    this.setState({ hostChecked: true, hostAllowed });
  }
  render() {
    if (this.state.hasError) return null;
    if (!this.state.hostChecked) return null;
    if (!this.state.hostAllowed) return null;
    return <GoogleAnalytics gaId={GA_MEASUREMENT_ID} />;
  }
}

function PostHogIdentify() {
  const { data: session, status } = useSession();
  /** Só fazer reset após logout — reset em qualquer visitante anónimo apagava identify feito no cadastro. */
  const hadAuthenticatedRef = useRef(false);

  useEffect(() => {
    const distinctId =
      session?.user?.supabaseId != null
        ? String(session.user.supabaseId)
        : session?.user?.id != null
          ? String(session.user.id)
          : null;

    if (distinctId) {
      posthog.identify(distinctId, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
      hadAuthenticatedRef.current = true;
    } else if (status !== 'loading' && hadAuthenticatedRef.current) {
      posthog.reset();
      hadAuthenticatedRef.current = false;
    }
  }, [session?.user?.supabaseId, session?.user?.id, session?.user?.email, session?.user?.name, status]);

  return null;
}

function SafePostHogProvider({ children }) {
  if (hasPosthogProjectKey()) {
    return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
  }
  return children;
}

/** Landing institucional + /parceiros — evita splash/mapa/missões que quebram marketing. */
function MarketingAppShell({ session, children }) {
  return (
    <SafePostHogProvider>
      <ErrorBoundary>
        <SessionProvider session={session}>
          <DeployRecovery />
          {children}
          <ClientOnly>
            <SafeGoogleAnalytics />
          </ClientOnly>
        </SessionProvider>
      </ErrorBoundary>
    </SafePostHogProvider>
  );
}

/** Painel do lojista — sessão + perfil, sem bottom nav. */
function MerchantAppShell({ session, children }) {
  return (
    <SafePostHogProvider>
      <ErrorBoundary>
        <SessionProvider session={session}>
          <PostHogIdentify />
          <UserRoleProvider>
            <AccountTypeGate>
              <DeployRecovery />
              {children}
            </AccountTypeGate>
          </UserRoleProvider>
        </SessionProvider>
      </ErrorBoundary>
    </SafePostHogProvider>
  );
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();
  const pathname = router.pathname || '';
  const marketing = isPublicMarketingPage(pathname);
  const merchantPanel = isMerchantPanelPage(pathname);

  useEffect(() => {
    capturePosthog('$pageview');
    const handleRouteChange = () => capturePosthog('$pageview');
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  if (!router.isReady) {
    if (marketing) {
      return (
        <MarketingAppShell session={session}>
          <Component {...pageProps} />
        </MarketingAppShell>
      );
    }
    if (merchantPanel) {
      return (
        <MerchantAppShell session={session}>
          <Component {...pageProps} />
        </MerchantAppShell>
      );
    }
    return (
      <SessionProvider session={session}>
        <MissionsTodayProvider>
          <Component {...pageProps} />
        </MissionsTodayProvider>
      </SessionProvider>
    );
  }

  if (marketing) {
    return (
      <MarketingAppShell session={session}>
        <Component {...pageProps} />
      </MarketingAppShell>
    );
  }

  if (merchantPanel) {
    return (
      <MerchantAppShell session={session}>
        <Component {...pageProps} />
      </MerchantAppShell>
    );
  }

  return (
    <SafePostHogProvider>
    <ErrorBoundary>
      <SessionProvider session={session}>
        <PostHogIdentify />
        <UserRoleProvider>
        <OnboardingTourProvider>
        <AccountTypeGate>
        <ProfileFirstLoginGate>
        <RecoveryIdentifierGate>
        <WelcomeBackGate>
        <AppSplashGate>
          <PWAInstallProvider>
            <ServiceWorkerRegister />
            <DeployRecovery />
            <AnalyticsProvider>
              <MissionsTodayProvider>
                <MapCartProvider>
                  {pathname === '/planos' ? (
                    <Component {...pageProps} />
                  ) : (
                    <PageTransitionLayout>
                      <Component {...pageProps} />
                    </PageTransitionLayout>
                  )}
                  <FeatureUsageRecorder />
                  <OnboardingGuideGate />
                  <AppMainBottomNav />
                </MapCartProvider>
              </MissionsTodayProvider>
              <Toaster richColors position="top-center" />
            </AnalyticsProvider>
          </PWAInstallProvider>
        </AppSplashGate>
        </WelcomeBackGate>
        </RecoveryIdentifierGate>
        </ProfileFirstLoginGate>
        </AccountTypeGate>
        </OnboardingTourProvider>
        </UserRoleProvider>
        <ClientOnly>
          <SafeGoogleAnalytics />
        </ClientOnly>
      </SessionProvider>
    </ErrorBoundary>
    </SafePostHogProvider>
  );
}
