import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

// Convert base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { api } = useAuth();
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    // Check if push notifications are supported
    const isSupported = 'serviceWorker' in navigator && 
                        'PushManager' in window && 
                        'Notification' in window;
    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported || !VAPID_PUBLIC_KEY) {
      console.error('Push not supported or VAPID key missing');
      return false;
    }

    setLoading(true);
    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        console.log('Permission not granted');
        return false;
      }

      // Wait for service worker
      const registration = await navigator.serviceWorker.ready;

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        // Create new subscription
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      // Send subscription to backend
      const subscriptionJSON = subscription.toJSON();
      await api.post('/notifications/subscribe', {
        endpoint: subscriptionJSON.endpoint,
        keys: subscriptionJSON.keys
      });

      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [api, supported]);

  const unsubscribe = useCallback(async () => {
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
      }

      await api.delete('/notifications/unsubscribe');
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    } finally {
      setLoading(false);
    }
  }, [api]);

  const sendTestNotification = useCallback(async () => {
    try {
      await api.post('/notifications/test');
      return true;
    } catch (error) {
      console.error('Error sending test notification:', error);
      return false;
    }
  }, [api]);

  return {
    supported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
    checkSubscription
  };
}

export default usePushNotifications;
