import { SessionProvider } from 'next-auth/react';
import { Toaster } from 'sonner';
import { useRouter } from 'next/router';
import { AccountTypeGate } from '../components/onboarding/AccountTypeGate';
import { UserRoleProvider } from '../contexts/UserRoleContext';
import { isMerchantPanelPage, isPublicMarketingPage } from '../lib/marketingRoutes';
import '../styles/globals.css';

function MerchantAppShell({ session, children }) {
  return (
    <SessionProvider session={session}>
      <UserRoleProvider>
        <AccountTypeGate>{children}</AccountTypeGate>
      </UserRoleProvider>
    </SessionProvider>
  );
}

function MarketingAppShell({ session, children }) {
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

export default function App({ Component, pageProps: { session, ...pageProps } }) {
  const router = useRouter();
  const pathname = router.pathname || '';
  const marketing = isPublicMarketingPage(pathname);
  const merchantPanel = isMerchantPanelPage(pathname);

  if (marketing || pathname === '/login' || pathname === '/escolher-perfil') {
    return (
      <MarketingAppShell session={session}>
        <Component {...pageProps} />
        <Toaster richColors position="top-center" />
      </MarketingAppShell>
    );
  }

  if (merchantPanel || pathname.startsWith('/historico-inventario') || pathname === '/mapa') {
    return (
      <MerchantAppShell session={session}>
        <Component {...pageProps} />
        <Toaster richColors position="top-center" />
      </MerchantAppShell>
    );
  }

  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
      <Toaster richColors position="top-center" />
    </SessionProvider>
  );
}
