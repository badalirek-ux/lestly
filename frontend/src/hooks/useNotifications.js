// hooks/useNotifications.js
// Gestisce: registrazione SW, permesso notifiche, invio notifiche in-app e native

import { useEffect, useRef, useCallback } from 'react';

export function useNotifications() {
  const swReg = useRef(null);

  // Registra il Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => { swReg.current = reg; })
        .catch(err => console.warn('SW non registrato:', err));
    }
  }, []);

  // Chiedi permesso notifiche
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    const result = await Notification.requestPermission();
    return result;
  }, []);

  // Invia notifica nativa (browser/telefono)
  const notify = useCallback(async (title, body, options = {}) => {
    const perm = await requestPermission();
    if (perm !== 'granted') return;

    if (swReg.current) {
      // Via Service Worker (funziona in background su mobile)
      swReg.current.showNotification(title, {
        body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        tag: options.tag || 'riderexpress',
        ...options
      });
    } else {
      // Fallback diretto
      new Notification(title, { body, icon: '/icon-192.png', ...options });
    }
  }, [requestPermission]);

  return { notify, requestPermission };
}
