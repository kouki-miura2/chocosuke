import type { JobRepository } from '../repository/job.repository.ts'
import type { StoreRepository } from '../repository/store.repository.ts'
import { type Runtime, requireUser } from './context.ts'

export interface SubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushService {
  /** Registers this device's push subscription for the user (replacing one with the same endpoint). */
  subscribe: (userId: string, input: SubscriptionInput) => Promise<void>
  /** Removes this device's subscription; nothing happens if it isn't the user's. */
  unsubscribe: (userId: string, endpoint: string) => Promise<void>
}

export const createPushService = (
  store: StoreRepository,
  jobs: JobRepository,
  runtime: Runtime,
): PushService => ({
  subscribe: async (userId, input) => {
    await requireUser(store, userId)
    await jobs.upsertSubscription({
      id: runtime.newId(),
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      createdAt: runtime.now(),
    })
  },

  unsubscribe: async (userId, endpoint) => {
    await jobs.deleteSubscriptionByEndpoint(userId, endpoint)
  },
})
