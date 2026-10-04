import type { DueEventRecord, JobDao } from 'backend/src/dao/job.interface.ts'
import type { PushSubscriptionRecord } from 'backend/src/dao/records.ts'

const syncedTables = ['event_images', 'events', 'topics', 'schedules'] as const

export const createJobDao = (db: D1Database): JobDao => {
  const run = async (statements: D1PreparedStatement[]) => {
    if (statements.length > 0) await db.batch(statements)
  }

  return {
    listDueEvents: async (now, limit) =>
      (
        await db
          .prepare(
            `SELECT e.id, e.title, e.start_date, e.start_time, e.notify_at,
                    s.name AS schedule_name, s.scope, e.owner_id
             FROM events e JOIN schedules s ON s.id = e.schedule_id
             WHERE e.notify_at IS NOT NULL AND e.notify_at <= ? AND e.deleted_at IS NULL
             ORDER BY e.notify_at LIMIT ?`,
          )
          .bind(now, limit)
          .all<DueEventRecord>()
      ).results,

    clearNotifyAt: (eventIds) =>
      run(
        eventIds.map((id) =>
          db.prepare('UPDATE events SET notify_at = NULL WHERE id = ?').bind(id),
        ),
      ),

    listSubscriptions: async (scope, ownerId) =>
      (
        await (
          scope === 'personal'
            ? db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').bind(ownerId)
            : db
                .prepare(
                  `SELECT p.* FROM push_subscriptions p JOIN users u ON u.id = p.user_id
                 WHERE u.group_id = ? AND u.deleted_at IS NULL`,
                )
                .bind(ownerId)
        ).all<PushSubscriptionRecord>()
      ).results,

    deleteSubscriptions: (ids) =>
      run(ids.map((id) => db.prepare('DELETE FROM push_subscriptions WHERE id = ?').bind(id))),

    listPurgeableImageIds: async (cutoff) =>
      (
        await db
          .prepare('SELECT id FROM event_images WHERE deleted_at < ?')
          .bind(cutoff)
          .all<{ id: string }>()
      ).results.map((row) => row.id),

    purge: (cutoff) =>
      run([
        // Remember the newest purged revision per owner before the rows go, so a client whose
        // revision is older than that gets a full fetch instead of a delta missing the deletions.
        ...syncedTables.flatMap((table) =>
          (['users', 'groups'] as const).map((owners) =>
            db
              .prepare(
                `UPDATE ${owners} SET purged_rev = MAX(purged_rev,
                   (SELECT MAX(rev) FROM ${table} WHERE owner_id = ${owners}.id AND deleted_at < ?))
                 WHERE id IN (SELECT owner_id FROM ${table} WHERE deleted_at < ?)`,
              )
              .bind(cutoff, cutoff),
          ),
        ),
        // Children before parents (foreign keys).
        ...syncedTables.map((table) =>
          db.prepare(`DELETE FROM ${table} WHERE deleted_at < ?`).bind(cutoff),
        ),
        db
          .prepare(
            'DELETE FROM push_subscriptions WHERE user_id IN (SELECT id FROM users WHERE deleted_at < ?)',
          )
          .bind(cutoff),
        db.prepare('DELETE FROM users WHERE deleted_at < ?').bind(cutoff),
        db.prepare('DELETE FROM groups WHERE deleted_at < ?').bind(cutoff),
      ]),
  }
}
