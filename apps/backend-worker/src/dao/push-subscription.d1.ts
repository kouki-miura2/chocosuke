import type { PushSubscriptionDao } from 'backend/src/dao/push-subscription.interface.ts'

export const createPushSubscriptionDao = (db: D1Database): PushSubscriptionDao => ({
  upsert: async (record) => {
    await db
      .prepare(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (endpoint) DO UPDATE SET
           user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
           created_at = excluded.created_at`,
      )
      .bind(
        record.id,
        record.user_id,
        record.endpoint,
        record.p256dh,
        record.auth,
        record.created_at,
      )
      .run()
  },

  deleteByEndpoint: async (userId, endpoint) => {
    await db
      .prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .bind(endpoint, userId)
      .run()
  },
})
