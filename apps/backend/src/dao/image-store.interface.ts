/** Object storage for event images (R2 in production). Objects are immutable. */
export interface ImageStore {
  put: (id: string, body: ArrayBuffer) => Promise<void>
  /** The image bytes, or `null` if the object is missing. */
  get: (id: string) => Promise<ReadableStream<Uint8Array> | null>
  copy: (fromId: string, toId: string) => Promise<void>
  delete: (ids: string[]) => Promise<void>
}
