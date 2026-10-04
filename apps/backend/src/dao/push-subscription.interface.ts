import type { PushSubscriptionRecord } from './records.ts'

export interface PushSubscriptionDao {
  /** Saves a subscription; an existing one with the same endpoint is replaced (it may move between users). */
  upsert: (record: PushSubscriptionRecord) => Promise<void>
  deleteByEndpoint: (userId: string, endpoint: string) => Promise<void>
}
