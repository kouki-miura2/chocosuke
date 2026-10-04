import { type Ref, onMounted } from 'vue'

// Google Identity Services (root AGENTS.md "Sign in with Google and terms consent"): the official
// button, loaded on demand. It can't be disabled, so consent is asked after sign-in.

interface GoogleIdentity {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: { credential: string }) => void
      }) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

let loading: Promise<GoogleIdentity> | undefined

const loadGoogleIdentity = (): Promise<GoogleIdentity> =>
  (loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('no gsi')))
    script.onerror = () => {
      loading = undefined
      reject(new Error('failed to load gsi'))
    }
    document.head.append(script)
  }))

/** The Google client id (`.env.local`); `undefined` while unset. */
export const googleClientId = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || undefined

/** Renders the official Google button into `container` once mounted; `onCredential` gets the ID token. */
export const useGoogleButton = (
  container: Ref<HTMLElement | null>,
  onCredential: (credential: string) => void,
  onError: () => void,
) => {
  onMounted(async () => {
    if (!googleClientId || !container.value) return
    try {
      const google = await loadGoogleIdentity()
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => onCredential(response.credential),
      })
      google.accounts.id.renderButton(container.value, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'signin_with',
        locale: 'ja',
        width: Math.min(400, container.value.clientWidth),
      })
    } catch {
      onError()
    }
  })
}
