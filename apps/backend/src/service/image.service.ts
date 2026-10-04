import { LIMITS } from 'utils'

import type { ImageStore } from '../dao/image-store.interface.ts'
import { AppError } from '../errors.ts'
import { type StoreRepository, insert, softDelete } from '../repository/store.repository.ts'
import { type Runtime, assertAccess, ownerFor, requireUser } from './context.ts'

export interface ImageInput {
  body: ArrayBuffer
  width: number
  height: number
}

export interface ImageService {
  addImage: (userId: string, eventId: string, input: ImageInput) => Promise<{ id: string }>
  deleteImage: (userId: string, id: string) => Promise<void>
  getImage: (userId: string, id: string) => Promise<ReadableStream<Uint8Array>>
}

/** JPEG files start with the SOI marker followed by another marker (FF D8 FF). */
const isJpeg = (body: ArrayBuffer): boolean => {
  const head = new Uint8Array(body, 0, Math.min(3, body.byteLength))
  return head.length === 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff
}

export const createImageService = (
  store: StoreRepository,
  images: ImageStore,
  runtime: Runtime,
): ImageService => {
  const findAccessibleImage = async (userId: string, id: string) => {
    const user = await requireUser(store, userId)
    const image = await store.findImage(id)
    if (!image) throw new AppError('NOT_FOUND')
    assertAccess(user, image.ownerId)
    return { user, image }
  }

  return {
    addImage: async (userId, eventId, input) => {
      const user = await requireUser(store, userId)
      const event = await store.findEvent(eventId)
      if (!event) throw new AppError('NOT_FOUND')
      assertAccess(user, event.ownerId)

      if (!isJpeg(input.body)) throw new AppError('VALIDATION', { message: 'not a JPEG' })
      if (input.body.byteLength > LIMITS.imageMaxBytes) {
        throw new AppError('LIMIT_EXCEEDED', { limit: 'imageMaxBytes' })
      }
      const existing = await store.listImages(eventId)
      if (existing.length >= LIMITS.imagesPerEvent) {
        throw new AppError('LIMIT_EXCEEDED', { limit: 'imagesPerEvent' })
      }
      const used = await store.sumImageBytes(event.ownerId)
      if (used + input.body.byteLength > LIMITS.imageStorageBytes) {
        throw new AppError('LIMIT_EXCEEDED', { limit: 'imageStorageBytes' })
      }

      const id = runtime.newId()
      const now = runtime.now()
      const owner = ownerFor(user, event.ownerId)
      await images.put(id, input.body)
      try {
        await store.commit(
          [owner],
          [
            insert(
              'event_images',
              {
                id,
                eventId,
                scheduleId: event.scheduleId,
                ownerId: event.ownerId,
                bytes: input.body.byteLength,
                width: input.width,
                height: input.height,
                sortOrder: Math.max(0, ...existing.map((image) => image.sortOrder + 1)),
                createdAt: now,
                updatedAt: now,
              },
              owner,
            ),
          ],
        )
      } catch (error) {
        await images.delete([id])
        throw error
      }
      return { id }
    },

    deleteImage: async (userId, id) => {
      const { user, image } = await findAccessibleImage(userId, id)
      const owner = ownerFor(user, image.ownerId)
      await store.commit([owner], [softDelete('event_images', { id }, runtime.now(), owner)])
    },

    getImage: async (userId, id) => {
      await findAccessibleImage(userId, id)
      const body = await images.get(id)
      if (!body) throw new AppError('NOT_FOUND')
      return body
    },
  }
}
