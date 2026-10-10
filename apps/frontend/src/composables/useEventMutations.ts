import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import type { EventInput } from '../api/types.ts'
import { useSyncingMutation } from './useSyncingMutation.ts'

/** A downscaled JPEG waiting to be uploaded. */
export interface NewImage {
  blob: Blob
  width: number
  height: number
}

// An image can take longer than the API's usual 3 s on a mobile connection.
const UPLOAD_TIMEOUT_MS = 30_000

const uploadImage = (eventId: string, image: NewImage) => {
  const query = new URLSearchParams({ width: String(image.width), height: String(image.height) })
  return call(
    fetch(`/api/events/${encodeURIComponent(eventId)}/images?${query.toString()}`, {
      method: 'POST',
      headers: { 'content-type': 'image/jpeg' },
      body: image.blob,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    }),
  )
}

/** Events and their images (docs/spec.md "イベント > 登録・変更・削除"). */
export const useEventMutations = () => ({
  /**
   * Saves in the spec's order: the event, then the added images, then the removed images. Resolves
   * to the event's id afterwards (it changes when the event moves to the other scope).
   */
  save: useSyncingMutation(
    async ({
      id,
      input,
      added,
      removedImageIds,
    }: {
      id?: string
      input: EventInput
      added: NewImage[]
      removedImageIds: string[]
    }) => {
      const saved = id
        ? await call(apiClient.api.events[':id'].$patch({ param: { id }, json: input }))
        : await call(apiClient.api.events.$post({ json: input }))
      for (const image of added) await uploadImage(saved.id, image)
      for (const imageId of removedImageIds) {
        await call(apiClient.api.images[':id'].$delete({ param: { id: imageId } }))
      }
      return saved.id
    },
  ),
  remove: useSyncingMutation((id: string) =>
    call(apiClient.api.events[':id'].$delete({ param: { id } })),
  ),
})
