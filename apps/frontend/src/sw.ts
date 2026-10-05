import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// The service worker (implementation plan F2): precaches the app so it opens without a network
// (the local DB is shown; docs/spec.md "共通ルール > オフライン"), never caches `/api`, and shows
// the event notifications (docs/spec.md "通知").

// Only the bits of the service worker globals used here (the `webworker` lib conflicts with `DOM`).
interface ExtendableEvent extends Event {
  waitUntil: (promise: Promise<unknown>) => void
}
interface PushEvent extends ExtendableEvent {
  data: { json: () => unknown } | null
}
interface NotificationEvent extends ExtendableEvent {
  notification: Notification
}
interface WindowClient {
  url: string
  focus: () => Promise<WindowClient>
  navigate: (url: string) => Promise<WindowClient | null>
}
interface ServiceWorkerScope {
  __WB_MANIFEST: (string | { url: string; revision: string | null })[]
  registration: ServiceWorkerRegistration
  skipWaiting: () => Promise<void>
  clients: {
    claim: () => Promise<void>
    matchAll: (options: { type: 'window'; includeUncontrolled: boolean }) => Promise<WindowClient[]>
    openWindow: (url: string) => Promise<WindowClient | null>
  }
  addEventListener: ((type: 'push', listener: (event: PushEvent) => void) => void) &
    ((type: 'notificationclick', listener: (event: NotificationEvent) => void) => void) &
    ((type: 'install' | 'activate', listener: (event: ExtendableEvent) => void) => void)
}

const sw = self as unknown as ServiceWorkerScope

// A new version takes over as soon as it's installed (`registerType: 'autoUpdate'` relies on it with
// our own service worker): otherwise it waits until every window of the app is closed, which an
// app kept in the background on a phone hardly ever is, and the old build keeps being served.
sw.addEventListener('install', () => void sw.skipWaiting())
sw.addEventListener('activate', (event) => event.waitUntil(sw.clients.claim()))

// Written out as `self.__WB_MANIFEST`: the build looks for exactly that to inject the file list.
precacheAndRoute((self as unknown as ServiceWorkerScope).__WB_MANIFEST)
cleanupOutdatedCaches()
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/^\/api\//] }),
)

/** What the notification job sends (`apps/backend/src/jobs.ts`). */
interface PushPayload {
  title: string
  body: string
  eventId: string
}

sw.addEventListener('push', (event) => {
  const payload = event.data?.json() as PushPayload | undefined
  if (!payload) return
  event.waitUntil(
    sw.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      tag: payload.eventId,
      data: { eventId: payload.eventId },
    }),
  )
})

// A tap opens the event detail, in an open window of the app if there is one.
sw.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const { eventId } = (event.notification.data ?? {}) as { eventId?: string }
  const url = eventId ? `/?event=${encodeURIComponent(eventId)}` : '/'
  event.waitUntil(
    (async () => {
      const [client] = await sw.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (client) {
        await client.navigate(url)
        await client.focus()
      } else {
        await sw.clients.openWindow(url)
      }
    })(),
  )
})
