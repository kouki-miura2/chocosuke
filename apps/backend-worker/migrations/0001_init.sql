-- Schema for docs/spec.md "データ仕様 > D1".
-- Times are epoch milliseconds, dates `YYYY-MM-DD` and times `HH:mm` in Asia/Tokyo.
-- `rev` on synced rows is the owner's revision (users.rev / groups.rev) at their last write; see
-- docs/spec.md "データ取得・同期". Foreign keys are only declared parent -> child within one owner's
-- data, so the daily purge can delete children first; references to users (updated_by,
-- owner_user_id, group membership) are not enforced because a purged user can still be referenced
-- by group data that lives on.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  agreed_terms_version INTEGER NOT NULL DEFAULT 0,
  group_id TEXT,
  member_name TEXT,
  joined_at INTEGER,
  schedule_order TEXT NOT NULL DEFAULT '[]',
  rev INTEGER NOT NULL DEFAULT 0,
  purged_rev INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX users_google_sub ON users (google_sub) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_member_name ON users (group_id, member_name) WHERE group_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX users_group_id ON users (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX users_deleted_at ON users (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  invite_token TEXT NOT NULL,
  invite_expires_at INTEGER NOT NULL,
  rev INTEGER NOT NULL DEFAULT 0,
  purged_rev INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX groups_invite_token ON groups (invite_token);
CREATE INDEX groups_deleted_at ON groups (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE schedules (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('personal', 'group')),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX schedules_name ON schedules (owner_id, name) WHERE deleted_at IS NULL;
CREATE INDEX schedules_sync ON schedules (owner_id, rev);
CREATE INDEX schedules_deleted_at ON schedules (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules (id),
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE UNIQUE INDEX topics_name ON topics (schedule_id, name) WHERE deleted_at IS NULL;
CREATE INDEX topics_sync ON topics (owner_id, rev);
CREATE INDEX topics_deleted_at ON topics (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL REFERENCES schedules (id),
  owner_id TEXT NOT NULL,
  topic_id TEXT REFERENCES topics (id),
  title TEXT NOT NULL,
  start_date TEXT NOT NULL,
  start_time TEXT,
  end_date TEXT NOT NULL,
  end_time TEXT,
  notify_minutes INTEGER,
  notify_at INTEGER,
  memo TEXT,
  updated_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX events_sync ON events (owner_id, rev);
CREATE INDEX events_day_count ON events (schedule_id, start_date) WHERE deleted_at IS NULL;
CREATE INDEX events_notify_at ON events (notify_at) WHERE notify_at IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX events_deleted_at ON events (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE event_images (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events (id),
  schedule_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  rev INTEGER NOT NULL,
  deleted_at INTEGER
);
CREATE INDEX event_images_sync ON event_images (owner_id, rev);
CREATE INDEX event_images_event_id ON event_images (event_id) WHERE deleted_at IS NULL;
CREATE INDEX event_images_schedule_id ON event_images (schedule_id) WHERE deleted_at IS NULL;
CREATE INDEX event_images_owner_bytes ON event_images (owner_id, bytes) WHERE deleted_at IS NULL;
CREATE INDEX event_images_deleted_at ON event_images (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX push_subscriptions_endpoint ON push_subscriptions (endpoint);
CREATE INDEX push_subscriptions_user_id ON push_subscriptions (user_id);
