import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    /** Reachable signed out (the guard in `index.ts` skips it). */
    public?: boolean
    /** Shows the bottom navigation (docs/spec.md "共通ルール > 画面"). */
    nav?: boolean
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true },
  },
  {
    // Reached by an unregistered account (no session yet) or after the terms were revised, so the
    // view checks which one itself.
    path: '/consent',
    name: 'consent',
    component: () => import('../views/ConsentView.vue'),
    meta: { public: true },
  },
  {
    path: '/terms',
    name: 'terms',
    component: () => import('../views/LegalView.vue'),
    props: { document: 'terms' },
    meta: { public: true },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('../views/LegalView.vue'),
    props: { document: 'privacy' },
    meta: { public: true },
  },
  {
    // `?event=<id>` opens the event detail (also the target of a notification tap).
    path: '/',
    name: 'calendar',
    component: () => import('../views/CalendarView.vue'),
    meta: { nav: true },
  },
  {
    // `?date=YYYY-MM-DD`: the start date of the new event.
    path: '/events/new',
    name: 'event-new',
    component: () => import('../views/EventEditView.vue'),
  },
  {
    path: '/events/:id/edit',
    name: 'event-edit',
    component: () => import('../views/EventEditView.vue'),
    props: true,
  },
  {
    path: '/schedules',
    name: 'schedules',
    component: () => import('../views/SchedulesView.vue'),
    meta: { nav: true },
  },
  {
    path: '/group',
    name: 'group',
    component: () => import('../views/GroupView.vue'),
    meta: { nav: true },
  },
  {
    path: '/invite/:token',
    name: 'invite',
    component: () => import('../views/InviteView.vue'),
    props: true,
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('../views/SettingsView.vue'),
    meta: { nav: true },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]
