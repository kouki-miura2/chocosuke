import type { ImageStore } from 'backend/src/dao/image-store.interface.ts'

/** Object key of an image (docs/spec.md "データ仕様 > R2"). */
const keyOf = (id: string) => `images/${id}.jpg`

const httpMetadata = { contentType: 'image/jpeg' }

/** R2 deletes at most 1,000 keys per call. */
const deleteChunk = 1000

export const createImageStore = (bucket: R2Bucket): ImageStore => ({
  put: async (id, body) => {
    await bucket.put(keyOf(id), body, { httpMetadata })
  },

  get: async (id) => (await bucket.get(keyOf(id)))?.body ?? null,

  copy: async (fromId, toId) => {
    const source = await bucket.get(keyOf(fromId))
    if (!source) throw new Error(`image object missing: ${fromId}`)
    // Read fully: R2 needs a known length to store a stream, and images are at most 1 MB.
    await bucket.put(keyOf(toId), await source.arrayBuffer(), { httpMetadata })
  },

  delete: async (ids) => {
    for (let start = 0; start < ids.length; start += deleteChunk) {
      await bucket.delete(ids.slice(start, start + deleteChunk).map(keyOf))
    }
  },
})
