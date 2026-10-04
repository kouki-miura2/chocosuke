import type {
  EventRecord,
  ImageRecord,
  ScheduleRecord,
  TopicRecord,
} from 'backend/src/dao/records.ts'
import type { SyncDao } from 'backend/src/dao/sync.interface.ts'

const syncedTables = ['schedules', 'topics', 'events', 'event_images'] as const

export const createSyncDao = (db: D1Database): SyncDao => ({
  readChanges: async (owner, sinceRev) => {
    // Both forms walk the (owner_id, rev) index, so rows read stay at the owner's own rows.
    const statements = syncedTables.map((table) =>
      sinceRev === null
        ? db
            .prepare(`SELECT * FROM ${table} WHERE owner_id = ? AND deleted_at IS NULL`)
            .bind(owner.id)
        : db
            .prepare(`SELECT * FROM ${table} WHERE owner_id = ? AND rev > ?`)
            .bind(owner.id, sinceRev),
    )
    const [schedules, topics, events, images] = await db.batch(statements)
    return {
      schedules: schedules.results as ScheduleRecord[],
      topics: topics.results as TopicRecord[],
      events: events.results as EventRecord[],
      images: images.results as ImageRecord[],
    }
  },
})
