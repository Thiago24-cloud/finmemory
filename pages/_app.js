import { Component } from 'react';
import { SessionProvider } from 'next-auth/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Toaster } from 'sonner';
import AnalyticsProvider from '../components/AnalyticsProvider';
import ClientOnly from '../components/ClientOnly';
import ErrorBoundary from '../components/ErrorBoundary';
import { AppSplashGate } from '../components/splash/AppSplashGate';
import { DeployRecovery } from '../components/DeployRecovery';
import PWAInstallProvider from '../components/PWAInstallProvider';
import ServiceWorkerRegister from '../components/ServiceWorkerRegister';
import { MapCartProvider } from '../components/map/MapCartContext';
import { GA_MEASUREMENT_ID, isGaAllowedHost } from '../lib/analytics';
import '../styles/globals.css';

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

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <ErrorBoundary>
      <SessionProvider session={session}>
        <AppSplashGate>
          <PWAInstallProvider>
            <ServiceWorkerRegister />
            <DeployRecovery />
            <AnalyticsProvider>
              <MapCartProvider>
                <Component {...pageProps} />
              </MapCartProvider>
              <Toaster richColors position="top-center" />
            </AnalyticsProvider>
          </PWAInstallProvider>
        </AppSplashGate>
        <ClientOnly>
          <SafeGoogleAnalytics />
        </ClientOnly>
      </SessionProvider>
    </ErrorBoundary>
  );
}
