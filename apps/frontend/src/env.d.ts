/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/vue" />

// Build-time public config (root AGENTS.md "Public config values for the frontend"). Values live in
// `.env.local`; every optional one may be unset, and the app still runs.
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
  /** Google OAuth web client id. Unset: no Google button (the development login in dev). */
  readonly VITE_GOOGLE_WEB_CLIENT_ID?: string
  /** VAPID public key (base64url). Unset: push notifications can't be turned on. */
  readonly VITE_VAPID_PUBLIC_KEY?: string
  /** Shown in the terms and privacy policy (root AGENTS.md "Operator name and contact ..."). */
  readonly VITE_OPERATOR_NAME?: string
  readonly VITE_CONTACT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
