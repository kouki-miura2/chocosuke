// Raw storage shapes: one type per D1 table row, column names as stored (snake_case). Repositories
// map these to camelCase domain types; nothing above the repository layer sees them.

export type Scope = 'personal' | 'group'

export interface UserRecord {
  id: string
  google_sub: string
  agreed_terms_version: number
  group_id: string | null
  member_name: string | null
  joined_at: number | null
  /** JSON array of schedule ids. */
  schedule_order: string
  rev: number
  purged_rev: number
  created_at: number
  deleted_at: number | null
}

export interface GroupRecord {
  id: string
  name: string
  owner_user_id: string
  invite_token: string
  invite_expires_at: number
  rev: number
  purged_rev: number
  created_at: number
  deleted_at: number | null
}

export interface ScheduleRecord {
  id: string
  scope: Scope
  owner_id: string
  name: string
  color: string
  created_at: number
  updated_at: number
  rev: number
  deleted_at: number | null
}

export interface TopicRecord {
  id: string
  schedule_id: string
  owner_id: string
  name: string
  created_at: number
  updated_at: number
  rev: number
  deleted_at: number | null
}

export interface EventRecord {
  id: string
  schedule_id: string
  owner_id: string
  topic_id: string | null
  title: string
  start_date: string
  start_time: string | null
  end_date: string
  end_time: string | null
  notify_minutes: number | null
  notify_at: number | null
  memo: string | null
  updated_by: string
  created_at: number
  updated_at: number
  rev: number
  deleted_at: number | null
}

export interface ImageRecord {
  id: string
  event_id: string
  schedule_id: string
  owner_id: string
  bytes: number
  width: number
  height: number
  sort_order: number
  created_at: number
  updated_at: number
  rev: number
  deleted_at: number | null
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  created_at: number
}
