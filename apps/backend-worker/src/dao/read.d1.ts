import type { ReadDao } from 'backend/src/dao/read.interface.ts'
import type {
  EventRecord,
  GroupRecord,
  ImageRecord,
  ScheduleRecord,
  TopicRecord,
  UserRecord,
} from 'backend/src/dao/records.ts'

export const createReadDao = (db: D1Database): ReadDao => {
  const first = <T>(sql: string, ...params: unknown[]) =>
    db
      .prepare(sql)
      .bind(...params)
      .first<T>()
  const all = async <T>(sql: string, ...params: unknown[]) =>
    (
      await db
        .prepare(sql)
        .bind(...params)
        .all<T>()
    ).results

  return {
    findUser: (id) => first<UserRecord>('SELECT * FROM users WHERE id = ?', id),
    findUserByGoogleSub: (googleSub) =>
      first<UserRecord>(
        'SELECT * FROM users WHERE google_sub = ? AND deleted_at IS NULL',
        googleSub,
      ),
    listMembers: (groupId) =>
      all<UserRecord>(
        'SELECT * FROM users WHERE group_id = ? AND deleted_at IS NULL ORDER BY joined_at, id',
        groupId,
      ),
    findGroup: (id) =>
      first<GroupRecord>('SELECT * FROM groups WHERE id = ? AND deleted_at IS NULL', id),
    findGroupByInviteToken: (token) =>
      first<GroupRecord>(
        'SELECT * FROM groups WHERE invite_token = ? AND deleted_at IS NULL',
        token,
      ),
    findSchedule: (id) =>
      first<ScheduleRecord>('SELECT * FROM schedules WHERE id = ? AND deleted_at IS NULL', id),
    listSchedules: (ownerId) =>
      all<ScheduleRecord>(
        'SELECT * FROM schedules WHERE owner_id = ? AND deleted_at IS NULL ORDER BY created_at, id',
        ownerId,
      ),
    findTopic: (id) =>
      first<TopicRecord>('SELECT * FROM topics WHERE id = ? AND deleted_at IS NULL', id),
    listTopics: (scheduleId) =>
      all<TopicRecord>(
        'SELECT * FROM topics WHERE schedule_id = ? AND deleted_at IS NULL ORDER BY created_at, id',
        scheduleId,
      ),
    findEvent: (id) =>
      first<EventRecord>('SELECT * FROM events WHERE id = ? AND deleted_at IS NULL', id),
    listEventsStartingBetween: (scheduleId, fromDate, toDate) =>
      all<EventRecord>(
        `SELECT * FROM events
         WHERE schedule_id = ? AND start_date BETWEEN ? AND ? AND deleted_at IS NULL`,
        scheduleId,
        fromDate,
        toDate,
      ),
    findImage: (id) =>
      first<ImageRecord>('SELECT * FROM event_images WHERE id = ? AND deleted_at IS NULL', id),
    listImages: (eventId) =>
      all<ImageRecord>(
        'SELECT * FROM event_images WHERE event_id = ? AND deleted_at IS NULL ORDER BY sort_order',
        eventId,
      ),
    sumImageBytes: async (ownerId) =>
      (
        await first<{ total: number }>(
          `SELECT COALESCE(SUM(bytes), 0) AS total FROM event_images
           WHERE owner_id = ? AND deleted_at IS NULL`,
          ownerId,
        )
      )?.total ?? 0,
  }
}
