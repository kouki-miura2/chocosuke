import type { EventRecord, ImageRecord, ScheduleRecord, TopicRecord } from './records.ts'
import type { Owner } from './write.interface.ts'

export interface ChangesRecord {
  schedules: ScheduleRecord[]
  topics: TopicRecord[]
  events: EventRecord[]
  images: ImageRecord[]
}

export interface SyncDao {
  /**
   * An owner's synced rows in one batch: with `sinceRev`, every row (deleted ones included) whose
   * `rev` is greater; with `null`, every live row (a full fetch).
   */
  readChanges: (owner: Owner, sinceRev: number | null) => Promise<ChangesRecord>
}
