/**
 * Detecção de contexto para instalação PWA (client-side).
 * @typedef {'android-chrome' | 'ios-safari' | 'ios-chrome' | 'samsung' | 'android-other' | 'desktop' | 'unknown'} PwaPlatform
 * @typedef {{
 *   isStandalone: boolean;
 *   platform: PwaPlatform;
 *   canUseNativePrompt: boolean;
 *   isInstallable: boolean;
 * }} InstallContext
 */

/**
 * @returns {InstallContext}
 */
export function detectInstallContext() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isStandalone: false,
      platform: 'unknown',
      canUseNativePrompt: false,
      isInstallable: false,
    };
  }

  const ua = navigator.userAgent;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    /** @type {{ standalone?: boolean }} */ (window.navigator).standalone === true;

  const isAndroid = /Android/i.test(ua);
  const isSamsung = /SamsungBrowser/i.test(ua);
  const isAndroidChrome =
    isAndroid &&
    /Chrome\//.test(ua) &&
    !/EdgA|OPR|SamsungBrowser/i.test(ua);
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isIosSafari =
    isIos && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
  const isIosChrome = isIos && /CriOS/i.test(ua);

  /** @type {InstallContext['platform']} */
  let platform = 'unknown';
  if (isSamsung) platform = 'samsung';
  else if (isAndroidChrome) platform = 'android-chrome';
  else if (isAndroid) platform = 'android-other';
  else if (isIosSafari) platform = 'ios-safari';
  else if (isIosChrome) platform = 'ios-chrome';
  else if (!/Mobi|Android/i.test(ua)) platform = 'desktop';

  const httpsOrLocal =
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  return {
    isStandalone,
    platform,
    canUseNativePrompt: false,
    isInstallable: 'serviceWorker' in navigator && httpsOrLocal,
  };
}

export const INSTALL_GUIDE_ASSETS = {
  androidMenu: '/install-guide/android-menu.gif',
  androidAdd: '/install-guide/android-add.gif',
  iosShare: '/install-guide/ios-share.gif',
  iosAddHomescreen: '/install-guide/ios-add-homescreen.gif',
  iosConfirm: '/install-guide/ios-confirm.gif',
};
