---
name: add-view
description: Add a new screen/view to apps/frontend - creating the view component, wiring it into the router, and adding server/UI state the Vue+Vuetify+vue-router way. Use when adding, wiring, or scaffolding a new frontend page/screen/route.
---

# Add a frontend view

`apps/frontend` is Vue 3 (`<script setup>`) + Vuetify 4 + vue-router, with server state through
TanStack Query and app-wide UI state through Pinia (see `apps/frontend/AGENTS.md`). A screen is
never just a `.vue` file — it's the view plus whatever composable/store it needs plus a route
table entry.

Worked references:

- `src/views/LegalView.vue` — a view with no server data.
- `src/views/SchedulesView.vue` — a view reading the synced data through `useAppData()` and
  changing it through `useScheduleMutations()` (each change is followed by a sync).
- `src/views/InviteView.vue` + `useInviteQuery` (`src/composables/useGroupMutations.ts`) — a
  view with its own query, showing its error itself (`meta: { quiet: true }`).
- `src/router/routes.ts` / `src/router/routes.test.ts` — the route table and its test.

## Procedure

### 1. Decide what state the view needs

- **Server data** (API responses): most screens only read the synced data (`useAppData()`) and
  change it with a mutation composable (`use*Mutations.ts`, built on `useSyncingMutation`). A
  composable in `src/composables/` wraps any other `useQuery`/`useMutation` — never call the API
  client inline in the component. See step 2.
- **Global UI state** shared app-wide (auth, view state, notifications, ...): a Pinia store in
  `src/stores/`, setup-function style. Only add a new store if an existing one doesn't already
  cover it — don't create a store for state that's local to this view.
- **Local/component state** (form inputs, modal open/closed): plain `ref()`/`reactive()` inside
  the view or a composable — doesn't need a store.

A view can need none, either, or both of the first two.

### 2. Add a query or mutation composable (only if the view needs new server calls)

- Wrap each API call in `call()` (`src/api/call.ts`) so errors become `ApiError` and reach the
  snackbar through the `QueryClient`.
- A change to synced data: add it to the domain's `use*Mutations.ts` with `useSyncingMutation`.
- Anything else: a `use<Name>Query` composable wrapping `useQuery`.
- Put the rules (validation, ordering, formatting) in a pure function under `src/lib/` with a
  co-located test; the composable and the view stay thin.

### 3. Create the view

- `src/views/<Name>View.vue` — `<script setup lang="ts">`, Vuetify components for layout
  (`v-container`, `v-card`, ...). Pull data from the composable/store from steps 1–2; don't fetch
  or hold server data in the component itself.
- Don't destructure `props` or a `reactive()` object directly (breaks reactivity) — use
  `toRefs()`/`toValue()`.

### 4. Register the route

- Add `{ path: '/<path>', name: '<name>', component: () => import('../views/<Name>View.vue') }`
  to `src/router/routes.ts`. Keep the component import lazy (arrow function), matching the
  existing entries.
- Set `meta.public` if it is reachable signed out, `meta.nav` if it shows the bottom navigation.
- Extend `src/router/routes.test.ts` with a case resolving the new path to the new route name
  (see the existing `resolves each screen` test). Use `router.resolve(...)`, not
  `router.push(...)` — `push` actually loads the lazy component, which drags in Vuetify's CSS and
  breaks under Node's module loader.

### 5. Link it from navigation (if the view should be reachable from the UI)

- A main screen: add it to the bottom navigation `tabs` in `App.vue`. Otherwise link it from the
  screen it belongs to.

### 6. Validate

```bash
vp check   # format, lint, type check
vp test    # or: vp run frontend#test
```

Tests run in Node with no jsdom/happy-dom — don't mount the new view component to test it; the
composable, store, and router entry are tested directly instead (steps 2 and 4), and that's the
DOM-free ceiling for what this view can be unit-tested with. To see the screen itself, run
`vp run frontend#dev` and open it in a browser.

## Notes

- Every file has its test right next to it (`foo.ts` + `foo.test.ts` / `routes.ts` +
  `routes.test.ts`) — never a separate `test/` or `__tests__/` tree.
- API request/response types come from `apps/backend`'s `AppType` via Hono RPC — never hand-write
  a DTO for the response a composable consumes.
- To see the screen, run `vp run backend-worker#dev` and `vp run frontend#dev`, and sign in with
  the development login (no Google client id needed).
