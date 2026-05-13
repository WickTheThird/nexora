// Opt-in card for Web Push notifications. Renders only when the browser
// supports the Push API and the user hasn't subscribed yet. Tap the
// button -> request OS permission -> register service worker -> create
// the PushSubscription -> POST to /me/push/subscribe.
//
// iOS Safari note: iOS only delivers web push when the page is
// installed as a PWA (Add to Home Screen). We surface that hint when
// we detect iOS without standalone mode.

import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const b64Std = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64Std);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function isStandalonePwa() {
  // Safari uses navigator.standalone; Chrome / others use display-mode.
  // The deprecated nav.standalone is iOS-only.
  return (
    (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushOptInCard() {
  const toast = useToast();
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const [iosWarning, setIosWarning] = useState(false);

  useEffect(() => {
    const sup =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(sup);
    if (!sup) return;
    setPermission(Notification.permission);
    if (isIos() && !isStandalonePwa()) setIosWarning(true);
    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (sub) setSubscribed(true);
      } catch {
        /* non-fatal */
      }
      try {
        const r = await api.getPushPublicKey();
        setVapidKey(r.publicKey);
      } catch {
        setVapidKey(null);
      }
    })();
  }, []);

  const subscribe = async () => {
    if (!vapidKey) {
      toast.error("Push notifications aren't configured yet. Ask the office.");
      return;
    }
    setBusy(true);
    try {
      // Register the service worker if not already.
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Permission denied. You can re-enable in your browser settings.");
        return;
      }
      // The TS DOM lib types want BufferSource backed by ArrayBuffer (not
      // SharedArrayBuffer). Allocate a fresh ArrayBuffer-backed view.
      const keyBytes = urlBase64ToUint8Array(vapidKey);
      const appServerKey = new Uint8Array(keyBytes.byteLength);
      appServerKey.set(keyBytes);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey.buffer,
      });
      await api.subscribePush(sub.toJSON());
      setSubscribed(true);
      toast.success("Phone notifications enabled.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await api.unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast.success("Notifications turned off.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  if (!supported) return null;
  // VAPID isn't configured server-side - render nothing to avoid a
  // dead "Enable" button.
  if (vapidKey === null) return null;

  if (subscribed) {
    return (
      <div className="card p-4 mb-6 flex items-center gap-3 bg-emerald-50 border-emerald-200">
        <div className="h-10 w-10 rounded-full bg-emerald-200 text-emerald-900 grid place-items-center shrink-0">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-ink-900">Phone notifications are on</div>
          <div className="text-xs text-ink-600">We'll ping you when there's a new Job Card, payment advice, or clock-in reminder.</div>
        </div>
        <Button variant="outline" size="sm" onClick={unsubscribe} loading={busy} leftIcon={<BellOff className="h-4 w-4" />}>
          Turn off
        </Button>
      </div>
    );
  }

  return (
    <div className="card p-4 mb-6 flex items-center gap-3 bg-ink-50 border-ink-200">
      <div className="h-10 w-10 rounded-full bg-ink-200 text-ink-700 grid place-items-center shrink-0">
        <Bell className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink-900">Get notifications on this phone</div>
        <div className="text-xs text-ink-600">
          Be alerted when a new Job Card needs your response or a payment advice arrives.
        </div>
        {iosWarning && (
          <div className="text-[11px] text-amber-700 mt-1">
            On iPhone you need to "Add to Home Screen" first, then open from the home screen icon.
          </div>
        )}
        {permission === "denied" && (
          <div className="text-[11px] text-red-700 mt-1">
            Notifications are blocked. Re-enable them in your browser settings.
          </div>
        )}
      </div>
      <Button
        variant="accent"
        size="sm"
        onClick={subscribe}
        loading={busy}
        disabled={permission === "denied"}
        leftIcon={<Bell className="h-4 w-4" />}
        className="min-h-12"
      >
        Enable
      </Button>
    </div>
  );
}
