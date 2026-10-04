# apps/frontend

- Vue 3 (Composition API, `<script setup>`).
- Vuetify 4 for UI components and theming (`src/plugins/vuetify.ts`: light theme only, Japanese locale, component defaults).
- vue-router for routing. The route table lives in `src/router/routes.ts`, separate from `src/router/index.ts` (which builds the actual `router` with `createWebHistory()` and the sign-in/consent guard), so tests can import `routes` without pulling in a browser-only history. `meta.public` marks screens reachable signed out, `meta.nav` the ones with the bottom navigation.
- TanStack Query (`@tanstack/vue-query`) for server state — see State below. The one `QueryClient` lives in `src/query-client.ts` (shared with the router guard); every query/mutation error goes through its caches to `main.ts`, which shows a snackbar or goes back to the login/consent screen. A query with `meta: { quiet: true }` shows its error itself.
- API access goes through a Hono RPC client (`hc<AppType>()`), built from a type-only import of `apps/backend`'s `AppType`. This gives full request/response type inference without a shared types package or manually written DTOs. The API is same-origin under `/api` (client base `/`, so routes are `apiClient.api.*`); in dev, `vite.config.ts` proxies `/api` to the backend dev server on `localhost:8787`. Wrap every call in `call()` (`src/api/call.ts`): it returns the success body and throws `ApiError` with the backend's error code; `errorMessage()` turns that into the message to show. Data shapes (`Schedule`, `CalendarEvent`, ...) are inferred in `src/api/types.ts`.
- TypeScript is pinned to `^6.x` here, independent of the workspace catalog's `^7.x`: `vue-tsc`/Vue Language Tools can't type-check `.vue` SFCs against TypeScript 7's native compiler yet (no public Program API). Re-sync to the catalog once vue-tsc supports it. `vp check` doesn't type-check `.vue` files; `vue-tsc --noEmit` (part of `build`) does.
- Build-time config (`.env.local`, root `AGENTS.md` "Public config values for the frontend") is typed in `src/env.d.ts`. Without `VITE_GOOGLE_WEB_CLIENT_ID`, `vp dev` shows a development login (`dev:<name>`, accepted only by a backend with `DEV_LOGIN=true`).
- PWA: `vite-plugin-pwa` in `injectManifest` mode with our own service worker `src/sw.ts` (precache, SPA navigation fallback, push notifications). It is off in `vp dev`; check it with a build served by `apps/backend-worker`.

## Data flow

Server data flows one way: sync API → local DB → memory (docs/spec.md "データ取得・同期").

- `src/db/local-db.ts`: the IndexedDB schema (`idb`) and reads; `src/db/apply-sync.ts`: stores one sync response in one transaction. Bump `VERSION` to change the structure (no migrations: the stores are emptied and refetched).
- `useSyncQuery` (`src/composables/useSyncQuery.ts`) is the only query of the app data: sync → local DB → return everything. `main.ts` seeds it from the local DB before mounting, so the screen shows data before the first sync returns.
- Screens read it through `useAppData()` (ordering, lookups, calendar entries as `computed`s). Filters, counts and ordering are computed from the local data, never asked of the API.
- Changes go through `useSyncingMutation` (in `use*Mutations.ts`): call the API, then `invalidateQueries(['sync'])`. Never patch the local data with an API response.

## State

State is split by kind — don't reach for Pinia as a catch-all:

- Server state goes through TanStack Query as above, wrapped in composables under `src/composables/` rather than called inline in components. Never store API response data in a Pinia store.
- Pinia (`src/stores`, one store per domain) is for global UI state only: the snackbar (`notification.ts`), the per-device view state saved in the local DB (`view-state.ts`), the sign-in in progress (`auth.ts`), where the calendar is (`calendar.ts`). Define stores with the setup-function style, not the Options style, and don't call the API from inside a Pinia action; that's TanStack Query's job. Nothing is stored in localStorage/sessionStorage (docs/spec.md "端末への保存").
- Local/component state (modal open/closed, form inputs, per-component derived values) stays in composables or component `ref`s — don't promote it to Pinia just because it's convenient.
- Don't destructure values out of `props` or a `reactive` object; it breaks reactivity. Use `toRefs()` or `toValue()` instead. Default to `ref()` for single values, `reactive()` only for grouping related fields (e.g. a form's values), and `ref()` when in doubt.
- When sharing state via `provide`/`inject`, type the key with `InjectionKey<T>` and expose access through a composable (e.g. `useMyContext()`) instead of calling `inject` directly at each call site.

## Testing

Tests run in Node (no jsdom/happy-dom), so keep test subjects DOM-free. Rules and layout live in pure functions under `src/lib/` (calendar layout, event form validation, CSV, formats, ...) and are tested there; components stay thin. Run with `vp test` / `vp run frontend#test`.

- Pure functions (`src/lib/*.test.ts`): plain inputs and outputs.
- Local DB (`src/db/apply-sync.test.ts`, `src/stores/view-state.test.ts`): `import 'fake-indexeddb/auto'` and open a DB with a unique name per test (`openLocalDb(name)`).
- API client (`src/api/client.test.ts`, `src/api/call.test.ts`): the typed RPC methods exist; `call()` maps responses and network failures.
- Pinia stores: call `setActivePinia(createPinia())` in `beforeEach`, then `useXxxStore()` and assert directly — no app mount needed.
- Router (`src/router/routes.test.ts`): build a throwaway router from the exported `routes` with vue-router's `createMemoryHistory()`, and assert with `router.resolve(...)` rather than `router.push(...)` — `push` actually loads the matched route's lazy component, which drags in Vuetify's CSS and breaks under Node's module loader.
- Screens are checked in a browser: `vp run backend-worker#dev` + `vp run frontend#dev`, then sign in with the development login.
