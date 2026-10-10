import type { PushSubscriptionRecord, Scope } from './records.ts'

/** An event whose notification is due, with what the notification shows and who receives it. */
export interface DueEventRecord {
  id: string
  title: string
  start_date: string
  start_time: string | null
  notify_at: number
  schedule_name: string
  scope: Scope
  owner_id: string
}

/** Data access for the cron jobs. */
export interface JobDao {
  /** Live events with `notify_at <= now`, oldest first, at most `limit`. */
  listDueEvents: (now: number, limit: number) => Promise<DueEventRecord[]>
  /** Clears `notify_at` without touching `rev` (the client never sees it). */
  clearNotifyAt: (eventIds: string[]) => Promise<void>
  /** Push subscriptions of a user (`personal`) or of every member of a group (`group`). */
  listSubscriptions: (scope: Scope, ownerId: string) => Promise<PushSubscriptionRecord[]>
  deleteSubscriptions: (ids: string[]) => Promise<void>
  /** Ids of images logically deleted before `cutoff` (their R2 objects are removed first). */
  listPurgeableImageIds: (cutoff: number) => Promise<string[]>
  /**
   * Physically deletes rows logically deleted before `cutoff`, children first, after raising each
   * owner's `purged_rev` to the highest `rev` among its deleted rows. Withdrawn users' push
   * subscriptions go with them.
   */
  purge: (cutoff: number) => Promise<void>
}
