# AGENTS.md

## Project Structure

Monorepo managed with pnpm workspaces (`apps/*`, `packages/*`). Project-specific conventions live in that project's own `AGENTS.md`, not here — read it before working in that folder.

- `apps/backend` — API server (Hono): runtime-agnostic routes and business logic, no entrypoint. See `apps/backend/AGENTS.md`.
- `apps/backend-worker` — Runs `apps/backend` on Cloudflare Workers. See `apps/backend-worker/AGENTS.md`.
- `apps/frontend` — Web client (Vue 3 + Vuetify 4). See `apps/frontend/AGENTS.md`.
- `packages/utils` — Shared runtime utilities (app-wide limits, date/time helpers, character counting, logger). See `packages/utils/AGENTS.md`.
- `docs/spec.md` — App specification (features, permissions, limits, architecture, data model). Read it before implementing or changing behavior, and keep it in sync when the behavior changes.

## Conventions

- Co-location: `foo/bar.ts` + `foo/bar.test.ts`.
- Arrow functions everywhere (`const foo = (...) => {}`), no `function` declarations — one style repo-wide, including `packages/utils`, so there's no per-case judgment call.
- Favor less code: reach for a framework's built-in feature over a hand-rolled one, avoid speculative abstractions and shared packages "just in case", and don't introduce a layer until it earns its keep.
- One origin in development and production: the frontend at `/`, the API at `/api`. In development `vp run frontend#dev` proxies `/api` to the backend dev server (`localhost:8787`); in production the runtime package serves both (see its `AGENTS.md`).
- API request/response types are not hand-shared: `apps/frontend` gets them from `apps/backend` via Hono RPC, not from a separate types package.
- Runtime-agnostic shared code goes in `packages/utils`, not duplicated per app.

### Public config values for the frontend

Values that aren't secret but differ per environment (e.g. a Google OAuth web client ID, a VAPID public key) reach the frontend as build-time env vars (`import.meta.env.VITE_*`). Don't add an API that returns config values (e.g. `GET /api/config`).

- Put the values in `apps/frontend/.env.local` (gitignored). `apps/frontend/.env` is committed and public, so it lists only the variable names and a description as comments, never the values:
  ```
  # VITE_GOOGLE_WEB_CLIENT_ID=<web OAuth client id>
  # VITE_VAPID_PUBLIC_KEY=<VAPID public key>   # only if Web Push is used
  ```
- Values the backend verifies against (the client ID accepted as the ID token's `aud`, the VAPID private key) are registered with `wrangler secret put` (locally: `apps/backend-worker/.dev.vars`), not written in `wrangler.jsonc` `vars`, so the public repository holds no environment-specific values.
- The app must still run when a value is unset (e.g. without a client ID, show the Google button disabled, and use a development login locally).
- Why: one fewer API, one fewer request at startup, one fewer loading state. The values only change on deploy, so baking them into the build costs nothing.
- Note: the client ID is set in two places, the frontend (`.env.local`) and the backend (secret). The deploy steps must list both.

### Sign in with Google and terms consent

The official Google sign-in button (Google Identity Services) can't be disabled, so don't design the login screen to keep the button disabled until a consent checkbox is ticked. Use this order instead:

1. The welcome screen shows the official Google button, which can be pressed before consenting.
2. The API verifies the ID token from the sign-in. A registered user goes straight to the home screen.
3. An unregistered user gets the consent screen: links to the terms of service and privacy policy, and a consent checkbox. "同意してはじめる" stays disabled until it's ticked.
4. After consent, call the registration API with the ID token and the version of the terms agreed to. The user is created only then.

- Consent is recorded at registration, on the server, so there's no need to ask for it before the sign-in button is pressed. When the terms are revised, show the consent screen the next time the app is opened.
- Links from the consent screen to the terms open in a new tab. Opening them in the same tab loses the signed-in state (the ID token).
- Only when the client ID is unset, show a disabled `v-btn` that looks like the Google button in its place. The Google button is `size: large`, pill-shaped, 40px high and at most 400px wide.

### Operator name and contact in the terms and privacy policy

Don't write the operator's name and contact email directly into the terms of service and privacy policy. Embed them from env vars.

- Put them in `apps/frontend/.env.local` (gitignored):
  ```
  VITE_OPERATOR_NAME=山田太郎
  VITE_CONTACT_EMAIL=contact@example.com
  ```
- `apps/frontend/.env` holds only a description:
  ```
  # VITE_OPERATOR_NAME / VITE_CONTACT_EMAIL: 利用規約・プライバシーポリシー（src/legal/documents.ts）に表示する運営者名と
  # 問い合わせ先。デプロイ前に .env.local で設定する。未設定のときは仮の表示になる。
  ```
- The document text (`src/legal/documents.ts`) falls back to placeholders when they're unset, and embeds them as `${OPERATOR}` / `${CONTACT}`:
  ```ts
  const OPERATOR: string = import.meta.env.VITE_OPERATOR_NAME ?? '（運営者名）'
  const CONTACT: string = import.meta.env.VITE_CONTACT_EMAIL ?? '（お問い合わせ先）'
  ```
- Note: the values are baked into the build, so anyone can see them in the published app. This keeps them out of the repository; it doesn't keep them secret.
- The terms and privacy policy text is written as a draft. The operator checks it for legal issues themselves. Whenever the text changes, set the terms version (`TERMS_VERSION`, read by both the frontend and the backend) to the revision date. The version is the date as a `YYYY-MM-DD` string, so string comparison orders it, and the database stores it as text.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
