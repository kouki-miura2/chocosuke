import { onMounted, ref } from 'vue'

import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'

// Web Push on this device (docs/spec.md "通知"): the subscription lives in the service worker
// (`src/sw.ts`); the server keeps one row per subscribed device.

/** The VAPID public key (`.env.local`); `undefined` while unset. */
export const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY || undefined

export const pushSupported = (): boolean =>
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator &&
  typeof window !== 'undefined' &&
  'PushManager' in window &&
  'Notification' in window

/** iOS delivers push only to the app added to the home screen. */
export const needsHomeScreen = (): boolean =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches

const currentSubscription = async (): Promise<PushSubscription | null> => {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

export const currentPushEndpoint = async (): Promise<string | undefined> =>
  (await currentSubscription())?.endpoint

/** Drops this device's subscription in the browser only (the server side goes with it elsewhere). */
export const unsubscribePush = async () => {
  await (await currentSubscription())?.unsubscribe()
}

const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replaceAll('-', '+')
    .replaceAll('_', '/')
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
}

/** The settings screen's notification switch. */
export const usePush = () => {
  const enabled = ref(false)
  const permission = ref<NotificationPermission | 'unsupported'>('unsupported')
  const busy = ref(false)

  onMounted(async () => {
    if (!pushSupported()) return
    permission.value = Notification.permission
    enabled.value = (await currentSubscription()) !== null
  })

  const turnOn = async () => {
    if (!vapidPublicKey) return
    permission.value = await Notification.requestPermission()
    if (permission.value !== 'granted') return
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(vapidPublicKey),
    })
    const { keys } = subscription.toJSON()
    await call(
      apiClient.api['push-subscriptions'].$post({
        json: {
          endpoint: subscription.endpoint,
          p256dh: keys?.p256dh ?? '',
          auth: keys?.auth ?? '',
        },
      }),
    )
    enabled.value = true
  }

  const turnOff = async () => {
    const subscription = await currentSubscription()
    if (subscription) {
      await call(
        apiClient.api['push-subscriptions'].$delete({ json: { endpoint: subscription.endpoint } }),
      )
      await subscription.unsubscribe()
    }
    enabled.value = false
  }

  const toggle = async (on: boolean) => {
    busy.value = true
    try {
      await (on ? turnOn() : turnOff())
    } finally {
      busy.value = false
    }
  }

  return { enabled, permission, busy, toggle }
}
