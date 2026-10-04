// How this device installs the app (docs/spec.md "設定 > 画面 > アプリをインストール"), when the
// browser offers no install prompt of its own.

/** `ios`: Safari's share button → "ホーム画面に追加"; `other`: the browser's own menu. */
export type InstallGuide = 'ios' | 'other'

/** iPhone/iPad (iPadOS Safari reports a Mac, told apart by its touch screen). */
export const installGuideFor = (userAgent: string, maxTouchPoints: number): InstallGuide =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
    ? 'ios'
    : 'other'
