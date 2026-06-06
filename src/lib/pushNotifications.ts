import { supabase } from "@/integrations/supabase/client";

export const VAPID_PUBLIC_KEY = "BLPBdhEX3udtV8W_bW6RAA5Gb5plKlwktA30gavhicLRUVLUOJ1WaqxQ41r70xvoi-Ad5Di-Krzd3NNrdK4WmmY";

export function isPushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/sw.js");
  if (existing) return existing;
  return await navigator.serviceWorker.register("/sw.js");
}

function bufToBase64(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export async function getPushStatus(): Promise<"unsupported" | "granted" | "denied" | "default"> {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission as "granted" | "denied" | "default";
}

export async function isSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/sw.js");
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch { return false; }
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) return { ok: false, reason: "Tu navegador no soporta notificaciones push." };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permiso denegado." };

  const reg = await getRegistration();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json: any = sub.toJSON();
  const endpoint = json.endpoint as string;
  const p256dh = json.keys?.p256dh ?? bufToBase64(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? bufToBase64(sub.getKey("auth"));

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ok: false, reason: "Sesión expirada." };

  // Upsert by endpoint
  const { error } = await supabase
    .from("push_subscriptions" as never)
    .upsert({
      user_id: uid,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent,
    } as never, { onConflict: "endpoint" } as never);

  if (error) return { ok: false, reason: error.message };
  return { ok: true };
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  try { await sub.unsubscribe(); } catch {}
  await supabase.from("push_subscriptions" as never).delete().eq("endpoint", endpoint);
}