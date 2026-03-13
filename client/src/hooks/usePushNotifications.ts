import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from './useApi';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type PushState = 'unsupported' | 'prompt' | 'subscribed' | 'denied';

export function usePushNotifications() {
  const { token } = useAuth();
  const [pushState, setPushState] = useState<PushState>(() => {
    if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    if (Notification.permission === 'granted') return 'subscribed';
    return 'prompt';
  });

  const subscribe = useCallback(async () => {
    if (!token || !VAPID_PUBLIC_KEY || typeof Notification === 'undefined' || !('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('/sw.js');

      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        if (result === 'denied') {
          setPushState('denied');
          return;
        }
        if (result !== 'granted') return;
      } else if (Notification.permission === 'denied') {
        setPushState('denied');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const subJson = subscription.toJSON();

      await api('/api/push/subscribe', {
        method: 'POST',
        token,
        body: {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        },
      });

      setPushState('subscribed');
    } catch (error) {
      console.error('Push subscription failed:', error);
    }
  }, [token]);

  // Auto-subscribe if already granted
  useEffect(() => {
    if (token && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      subscribe();
    }
  }, [token, subscribe]);

  return { pushState, subscribe };
}
