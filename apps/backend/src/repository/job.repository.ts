import type { DueEventRecord, JobDao } from '../dao/job.interface.ts'
import type { PushSubscriptionDao } from '../dao/push-subscription.interface.ts'
import type { PushSubscriptionRecord, Scope } from '../dao/records.ts'
import { type Camelize, camelize, snakify } from './case.ts'

export type DueEvent = Camelize<DueEventRecord>
export type PushSubscription = Camelize<PushSubscriptionRecord>

/** Push subscriptions (written by the API) and the cron jobs' data access. */
export interface JobRepository {
  listDueEvents: (now: number, limit: number) => Promise<DueEvent[]>
  clearNotifyAt: (eventIds: string[]) => Promise<void>
  listSubscriptions: (scope: Scope, ownerId: string) => Promise<PushSubscription[]>
  upsertSubscription: (subscription: PushSubscription) => Promise<void>
  deleteSubscriptionByEndpoint: (userId: string, endpoint: string) => Promise<void>
  deleteSubscriptions: (ids: string[]) => Promise<void>
  listPurgeableImageIds: (cutoff: number) => Promise<string[]>
  purge: (cutoff: number) => Promise<void>
}

export const createJobRepository = (
  jobs: JobDao,
  subscriptions: PushSubscriptionDao,
): JobRepository => ({
  listDueEvents: async (now, limit) => (await jobs.listDueEvents(now, limit)).map(camelize),
  clearNotifyAt: (eventIds) => jobs.clearNotifyAt(eventIds),
  listSubscriptions: async (scope, ownerId) =>
    (await jobs.listSubscriptions(scope, ownerId)).map(camelize),
  upsertSubscription: (subscription) =>
    subscriptions.upsert(snakify(subscription) as unknown as PushSubscriptionRecord),
  deleteSubscriptionByEndpoint: (userId, endpoint) =>
    subscriptions.deleteByEndpoint(userId, endpoint),
  deleteSubscriptions: (ids) => jobs.deleteSubscriptions(ids),
  listPurgeableImageIds: (cutoff) => jobs.listPurgeableImageIds(cutoff),
  purge: (cutoff) => jobs.purge(cutoff),
})
