import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PwaStatusInfo {
  isOnline: boolean;
  isStandalone: boolean;
  canInstall: boolean;
  swStatus: 'unsupported' | 'registering' | 'active' | 'error';
  updateAvailable: boolean;
  installOutcomeMessage: string | null;
  triggerInstallPrompt: () => Promise<void>;
  applyServiceWorkerUpdate: () => void;
  checkForServiceWorkerUpdate: () => Promise<boolean>;
  dismissUpdateBanner: () => void;
  triggerTestUpdateNotification: () => void;
}

export function usePwaManager(): PwaStatusInfo {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [swStatus, setSwStatus] = useState<
    'unsupported' | 'registering' | 'active' | 'error'
  >('registering');
  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [installOutcomeMessage, setInstallOutcomeMessage] = useState<
    string | null
  >(null);

  // Track online/offline status & standalone display mode
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const checkStandalone = () => {
      const navStandalone = Boolean(
        (window.navigator as unknown as { standalone?: boolean }).standalone
      );
      setIsStandalone(mediaQuery.matches || navStandalone);
    };
    checkStandalone();
    mediaQuery.addEventListener('change', checkStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setInstallOutcomeMessage(
        'My Money Tracker is installed on your device and ready for standalone offline use.'
      );
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      mediaQuery.removeEventListener('change', checkStandalone);
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Register Service Worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      setSwStatus('unsupported');
      return;
    }

    let isMounted = true;
    const swUrl = './sw.js';

    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => {
        if (!isMounted) return;
        setRegistration(reg);
        setSwStatus('active');

        if (reg.waiting) {
          setUpdateAvailable(true);
        }

        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (!installingWorker) return;

          installingWorker.addEventListener('statechange', () => {
            if (
              installingWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        if (isMounted) setSwStatus('error');
      });

    let refreshing = false;
    const handleControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );

    return () => {
      isMounted = false;
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
    };
  }, []);

  const triggerInstallPrompt = useCallback(async () => {
    if (!deferredPrompt) {
      setInstallOutcomeMessage(
        'To install on Android Chrome: tap the browser menu (⋮) and select "Install app" or "Add to Home screen".'
      );
      return;
    }
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferredPrompt(null);
      setInstallOutcomeMessage(
        'Installation accepted! Open Money Tracker from your Home screen.'
      );
    } else {
      setInstallOutcomeMessage(
        'Installation dismissed. You can install anytime from Settings.'
      );
    }
  }, [deferredPrompt]);

  const applyServiceWorkerUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } else {
      setUpdateAvailable(false);
      window.location.reload();
    }
  }, [registration]);

  const checkForServiceWorkerUpdate = useCallback(async (): Promise<boolean> => {
    if (!registration) return false;
    try {
      await registration.update();
      if (registration.waiting) {
        setUpdateAvailable(true);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [registration]);

  const dismissUpdateBanner = useCallback(() => {
    setUpdateAvailable(false);
  }, []);

  const triggerTestUpdateNotification = useCallback(() => {
    setUpdateAvailable(true);
  }, []);

  return {
    isOnline,
    isStandalone,
    canInstall: Boolean(deferredPrompt),
    swStatus,
    updateAvailable,
    installOutcomeMessage,
    triggerInstallPrompt,
    applyServiceWorkerUpdate,
    checkForServiceWorkerUpdate,
    dismissUpdateBanner,
    triggerTestUpdateNotification,
  };
}
