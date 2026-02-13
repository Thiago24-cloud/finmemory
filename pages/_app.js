import { Component } from 'react';
import { SessionProvider } from 'next-auth/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import { Toaster } from 'sonner';
import AnalyticsProvider from '../components/AnalyticsProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import '../styles/globals.css';

/** Evita que falha do Google Analytics derrube o app ao abrir */
class SafeGoogleAnalytics extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err, info) {
    console.warn('GoogleAnalytics error (ignored):', err?.message || err, info);
  }
  render() {
    if (this.state.hasError) return null;
    return <GoogleAnalytics gaId="G-K783HNBGE8" />;
  }
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <ErrorBoundary>
      <SessionProvider session={session}>
        <AnalyticsProvider>
          <Component {...pageProps} />
          <Toaster richColors position="top-center" />
        </AnalyticsProvider>
        <SafeGoogleAnalytics />
      </SessionProvider>
    </ErrorBoundary>
  );
}
