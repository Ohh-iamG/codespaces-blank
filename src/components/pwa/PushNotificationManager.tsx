import React, { useState, useEffect } from 'react';
import { Bell, BellOff, BellRing, Check, AlertCircle, Send, Shield, Pill, HeartPulse, X } from 'lucide-react';
import { apiFetch } from '../../lib/api';

function urlBase64ToUint8Array(base64String: string) {
  if (typeof window === 'undefined' || typeof window.atob !== 'function') {
    throw new Error('This browser does not support base64 conversion for push subscriptions.');
  }

  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function PushNotificationManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission);
    checkSubscription();
  }, []);

  const checkSubscription = async () => {
    try {
      if (!('serviceWorker' in navigator)) return;
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.warn('Error checking push subscription:', err);
    }
  };

  const subscribeUser = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setStatusMessage('Push notifications not supported on this browser engine.');
        return;
      }

      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        setStatusMessage('Notification permission was not granted.');
        return;
      }

      // Fetch VAPID key
      const keyRes = await apiFetch('/api/push/public-key');
      const { publicKey } = await keyRes.json();
      if (!publicKey) {
        throw new Error('VAPID public key unavailable');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const convertedVapidKey = urlBase64ToUint8Array(publicKey);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey,
        });
      }

      // Send subscription to server
      const saveRes = await apiFetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          userAgent: navigator.userAgent,
        }),
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save subscription on server');
      }

      setIsSubscribed(true);
      setStatusMessage('Phone lock screen push notifications actively registered!');
    } catch (err: any) {
      console.error('Subscription error:', err);
      setStatusMessage(err.message || 'Push registration failed');
    } finally {
      setLoading(false);
    }
  };

  const triggerTestPush = async (type: 'dose' | 'circle' | 'checkin') => {
    setIsTesting(type);
    setStatusMessage(null);
    try {
      const res = await apiFetch('/api/push/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });
      const data = await res.json();
      if (data.sentCount > 0) {
        setStatusMessage(`Push notification dispatched to lock screen (${data.sentCount} devices)!`);
      } else {
        // Fallback to local notification if push service worker hasn't received push endpoint yet
        if (Notification.permission === 'granted') {
          new Notification(data.preview?.title || 'IZA Sovereign Alert', {
            body: data.preview?.body || 'Test push alert',
            icon: '/pwa-192x192.png',
          });
          setStatusMessage('Direct local notification fired (subscription pending remote sync).');
        } else {
          setStatusMessage(data.message || 'Alert created.');
        }
      }
    } catch (err: any) {
      setStatusMessage(err.message || 'Test push failed');
    } finally {
      setIsTesting(null);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-lg transition active:scale-95 cursor-pointer ${
          isSubscribed
            ? 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40 hover:bg-emerald-900/60'
            : 'text-amber-300 bg-amber-950/50 border-amber-500/40 hover:bg-amber-900/50'
        }`}
        title="Web Push Notifications for Doses, Circle Nudges & Urgent Alerts"
      >
        {isSubscribed ? (
          <BellRing className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
        ) : (
          <Bell className="w-3.5 h-3.5 text-amber-400" />
        )}
        <span className="hidden sm:inline">
          {isSubscribed ? 'PUSH ALERTS: ARMED' : 'ENABLE PUSH'}
        </span>
      </button>

      {/* Push Configuration & Testing Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl p-5 shadow-2xl text-slate-100 font-mono">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-lg">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100 uppercase tracking-wider">
                    Web Push & Phone Lock Screen Alerts
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Native notifications for doses, circle nudges, and urgent telemetry
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-950/80 rounded-lg border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200">Phone Shell Push Subscription</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    {permission === 'granted' && isSubscribed
                      ? 'Connected • Alerts arrive even when browser is closed'
                      : permission === 'denied'
                      ? 'Notifications blocked in browser settings'
                      : 'Not enabled yet on this device'}
                  </div>
                </div>

                {!isSubscribed ? (
                  <button
                    onClick={subscribeUser}
                    disabled={loading || permission === 'denied'}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>{loading ? 'Arming...' : 'Arm Push Alerts'}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1 px-2.5 py-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md">
                    <Check className="w-3.5 h-3.5" />
                    <span>Armed</span>
                  </div>
                )}
              </div>

              {statusMessage && (
                <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-[11px] text-cyan-300 flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Push Trigger Simulation */}
              <div>
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Test Native Phone Triggers
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={() => triggerTestPush('dose')}
                    disabled={isTesting !== null}
                    className="flex flex-col items-start p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-emerald-500/50 rounded-lg transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 text-emerald-400 font-semibold mb-1">
                      <Pill className="w-3.5 h-3.5" />
                      <span>Dose Reminder</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Metformin 500mg due with water
                    </span>
                    <span className="text-[9px] text-cyan-400 mt-2 font-mono group-hover:underline">
                      {isTesting === 'dose' ? 'Firing...' : 'Send Push →'}
                    </span>
                  </button>

                  <button
                    onClick={() => triggerTestPush('circle')}
                    disabled={isTesting !== null}
                    className="flex flex-col items-start p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-cyan-500/50 rounded-lg transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 text-cyan-400 font-semibold mb-1">
                      <Shield className="w-3.5 h-3.5" />
                      <span>Circle Nudge</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      Family/Circle heartbeat check-in
                    </span>
                    <span className="text-[9px] text-cyan-400 mt-2 font-mono group-hover:underline">
                      {isTesting === 'circle' ? 'Firing...' : 'Send Push →'}
                    </span>
                  </button>

                  <button
                    onClick={() => triggerTestPush('checkin')}
                    disabled={isTesting !== null}
                    className="flex flex-col items-start p-2.5 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 hover:border-amber-500/50 rounded-lg transition text-left cursor-pointer group"
                  >
                    <div className="flex items-center gap-1.5 text-amber-400 font-semibold mb-1">
                      <HeartPulse className="w-3.5 h-3.5" />
                      <span>Urgent Check-in</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
                      HRV & stress level request
                    </span>
                    <span className="text-[9px] text-cyan-400 mt-2 font-mono group-hover:underline">
                      {isTesting === 'checkin' ? 'Firing...' : 'Send Push →'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Protocol Spec */}
              <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="font-semibold text-slate-300">PWA Native Shell Capabilities:</div>
                <div>• Service Worker background caching enables zero-latency cold starts.</div>
                <div>• VAPID encrypted Web Push API drives phone lock screen banners.</div>
                <div>• Standalone display mode removes browser URL chrome and tabs.</div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 rounded-lg transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
