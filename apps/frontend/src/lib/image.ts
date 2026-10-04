import { LIMITS } from 'utils'

/** The size of an image scaled down so its long edge is at most `maxPx` (never scaled up). */
export const fitWithin = (
  width: number,
  height: number,
  maxPx: number = LIMITS.imageMaxPx,
): { width: number; height: number } => {
  const scale = Math.min(1, maxPx / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** JPEG quality of uploaded images (docs/spec.md "イベント > 画像"). */
export const JPEG_QUALITY = 0.85
