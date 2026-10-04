import { readonly, ref, shallowRef } from 'vue'

import { type InstallGuide, installGuideFor } from '../lib/install.ts'

// Installing the app as a PWA (docs/spec.md "設定 > 画面 > アプリをインストール"). Chrome / Edge /
// Android hand out an install prompt (`beforeinstallprompt`) once, possibly before the settings
// screen is open, so `listenForInstallPrompt` keeps it from startup. Safari has no prompt: the
// person adds the app by hand, so the screen shows how instead.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const promptEvent = shallowRef<BeforeInstallPromptEvent | null>(null)
const installed = ref(false)

const runningInstalled = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true

/** Called once from `main.ts`, before anything is mounted. */
export const listenForInstallPrompt = () => {
  installed.value = runningInstalled()
  window.addEventListener('beforeinstallprompt', (event) => {
    // Kept for the settings button instead of the browser's own banner.
    event.preventDefault()
    promptEvent.value = event as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    promptEvent.value = null
  })
}

export const usePwaInstall = () => {
  /**
   * Shows the browser's install prompt when it has one, else resolves to how to install by hand
   * (`null` once prompted).
   */
  const install = async (): Promise<InstallGuide | null> => {
    const event = promptEvent.value
    if (!event) return installGuideFor(navigator.userAgent, navigator.maxTouchPoints)
    await event.prompt()
    // A prompt can be used only once, whatever the answer.
    promptEvent.value = null
    if ((await event.userChoice).outcome === 'accepted') installed.value = true
    return null
  }

  return { installed: readonly(installed), install }
}
