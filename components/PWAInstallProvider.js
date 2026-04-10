import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import PWAInstallAssistant from './PWAInstallAssistant';

const PWAInstallUIContext = createContext(
  /** @type {{ openInstallAssistant: () => void; installEntryVisible: boolean } | null} */ (null)
);

export function usePWAInstallUI() {
  const ctx = useContext(PWAInstallUIContext);
  if (!ctx) {
    throw new Error('usePWAInstallUI deve ser usado dentro de PWAInstallProvider');
  }
  return ctx;
}

/** @returns {{ openInstallAssistant: () => void; installEntryVisible: boolean } | null} */
export function usePWAInstallUIOptional() {
  return useContext(PWAInstallUIContext);
}

export default function PWAInstallProvider({ children }) {
  const {
    context,
    showAssistant,
    setShowAssistant,
    triggerNativePrompt,
    dismiss,
  } = usePWAInstall();

  const [installMarkedDone, setInstallMarkedDone] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const sync = () => {
      try {
        setInstallMarkedDone(localStorage.getItem('fm_install_done') === '1');
      } catch (_) {
        setInstallMarkedDone(false);
      }
    };
    sync();
    const onDone = () => setInstallMarkedDone(true);
    window.addEventListener('fm-pwa-install-done', onDone);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('fm-pwa-install-done', onDone);
      window.removeEventListener('storage', sync);
    };
  }, [showAssistant]);

  const openInstallAssistant = useCallback(() => {
    if (!context) return;
    if (context.isStandalone) return;
    if (context.platform === 'desktop') return;
    setShowAssistant(true);
  }, [context, setShowAssistant]);

  const installEntryVisible = Boolean(
    context &&
      !context.isStandalone &&
      context.platform !== 'desktop' &&
      !installMarkedDone
  );

  const value = useMemo(
    () => ({
      openInstallAssistant,
      installEntryVisible,
    }),
    [openInstallAssistant, installEntryVisible]
  );

  return (
    <PWAInstallUIContext.Provider value={value}>
      {children}
      {showAssistant && context ? (
        <PWAInstallAssistant
          context={context}
          onTriggerNative={triggerNativePrompt}
          onDismiss={dismiss}
        />
      ) : null}
    </PWAInstallUIContext.Provider>
  );
}
