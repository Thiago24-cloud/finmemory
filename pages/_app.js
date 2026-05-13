import { Component, useEffect } from 'react';
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
import AppMainBottomNav from '../components/AppMainBottomNav';
import PageTransitionLayout from '../components/PageTransitionLayout';
import { GA_MEASUREMENT_ID, isGaAllowedHost } from '../lib/analytics';
import '../styles/globals.css';

if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    // Tráfego via reverse proxy em `next.config.ts` (`/ingest` → PostHog Cloud).
    api_host: `${window.location.origin}/ingest`,
    capture_pageview: false,
    capture_pageleave: true,
  });
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
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.user?.id) {
      posthog.identify(session.user.id, {
        email: session.user.email ?? undefined,
        name: session.user.name ?? undefined,
      });
    } else {
      posthog.reset();
    }
  }, [session?.user?.id]);
  return null;
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();

  useEffect(() => {
    // Pageview da página inicial (routeChangeComplete não dispara no primeiro load)
    posthog.capture('$pageview');
    const handleRouteChange = () => posthog.capture('$pageview');
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  return (
    <PostHogProvider client={posthog}>
    <ErrorBoundary>
      <SessionProvider session={session}>
        <PostHogIdentify />
        <ProfileFirstLoginGate>
        <AppSplashGate>
          <PWAInstallProvider>
            <ServiceWorkerRegister />
            <DeployRecovery />
            <AnalyticsProvider>
              <MissionsTodayProvider>
                <MapCartProvider>
                  <PageTransitionLayout>
                    <Component {...pageProps} />
                  </PageTransitionLayout>
                  <AppMainBottomNav />
                </MapCartProvider>
              </MissionsTodayProvider>
              <Toaster richColors position="top-center" />
            </AnalyticsProvider>
          </PWAInstallProvider>
        </AppSplashGate>
        </ProfileFirstLoginGate>
        <ClientOnly>
          <SafeGoogleAnalytics />
        </ClientOnly>
      </SessionProvider>
    </ErrorBoundary>
    </PostHogProvider>
  );
}
