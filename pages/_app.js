import { SessionProvider } from 'next-auth/react';
import { GoogleAnalytics } from '@next/third-parties/google';
import AnalyticsProvider from '../components/AnalyticsProvider';
import '../styles/globals.css';

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <AnalyticsProvider>
        <Component {...pageProps} />
      </AnalyticsProvider>
      <GoogleAnalytics gaId="G-K783HNBGE8" />
    </SessionProvider>
  );
}
