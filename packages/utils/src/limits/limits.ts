/**
 * App-wide limits and tunable values: every cap, size, duration and count the app enforces or
 * depends on, in one place. Single source of truth for the `docs/spec.md` "参照 > リミット値" table —
 * one entry per table row, referenced there as `LIMITS.<name>`. Values may change during
 * development or operation: change them here only, and update the spec table in the same change.
 *
 * Imported by both `apps/frontend` (to validate and show the limit in the UI) and `apps/backend`
 * (to enforce it in the API), so the two can never disagree.
 *
 * Conventions for each entry:
 * - Name it after what it limits, with the unit as a suffix: `...Bytes`, `...Px`, `...Days`,
 *   `...Minutes`, `...MaxLength` (characters, counted with `charLength`), a plain noun for a count.
 * - Write the value in its readable form (`300 * 1024 * 1024`, not `314572800`).
 * - JSDoc: what it limits, the unit, where it's checked (UI / API / both), and "Provisional." if
 *   the spec marks it 暫定値.
 */
export const LIMITS = {
  /** Max members per group. Checked in both the UI and the API when joining. */
  groupMembers: 5,
  /** Max personal schedules (予定) per user. Checked in both the UI and the API. Provisional. */
  personalSchedules: 10,
  /** Max group schedules (予定) per group. Checked in both the UI and the API. Provisional. */
  groupSchedules: 10,
  /**
   * Max events per schedule per day; a multi-day event counts once on each day it spans. Checked
   * in both the UI and the API on event create/update. Provisional.
   */
  eventsPerDayPerSchedule: 10,
  /** Max topics per schedule. Checked in both the UI and the API. */
  topicsPerSchedule: 10,
  /** Max length (characters) of a member name. Checked in both the UI and the API. */
  memberNameMaxLength: 20,
  /** Max length (characters) of a group name. Checked in both the UI and the API. Provisional. */
  groupNameMaxLength: 20,
  /** Max length (characters) of a schedule name. Checked in both the UI and the API. */
  scheduleNameMaxLength: 20,
  /** Max length (characters) of a topic name. Checked in both the UI and the API. Provisional. */
  topicNameMaxLength: 20,
  /** Max length (characters) of an event title. Checked in both the UI and the API. Provisional. */
  eventTitleMaxLength: 50,
  /** Max length (characters) of an event memo. Checked in both the UI and the API. Provisional. */
  eventMemoMaxLength: 1000,
  /**
   * Max days an event spans, start and end date inclusive. Checked in both the UI and the API.
   * Also bounds the `start_date` lower limit of the per-day count query.
   */
  eventMaxDays: 25,
  /** Max images per event. Checked in both the UI and the API. Provisional. */
  imagesPerEvent: 3,
  /** Max long-edge size of an image, in px; the UI downscales to this before upload. Provisional. */
  imageMaxPx: 2048,
  /** Max size of one image after downscaling, in bytes (1 MB). Checked in both the UI and the API. Provisional. */
  imageMaxBytes: 1 * 1024 * 1024,
  /** Total image storage per owner (user or group), in bytes (200 MB). Checked in the API. Provisional. */
  imageStorageBytes: 200 * 1024 * 1024,
  /** First year that can be shown or registered. Checked in both the UI and the API. */
  calendarMinYear: 2021,
  /**
   * Years after the current year that can be shown or registered (3 → through 2029/12/31 in
   * 2026). Checked in both the UI and the API.
   */
  calendarYearsAhead: 3,
  /** Max dots per day in the month view's dot style. Applied in the UI. */
  monthDotsPerDay: 4,
  /** Validity of an invite link, in hours. Set on issue, checked in the API on join. */
  inviteExpiryHours: 12,
  /** Lifetime of a login session, in days. Checked in the API. Provisional. */
  sessionDays: 30,
  /** Interval of the sync API call while the app is in the foreground, in minutes. Provisional. */
  syncCheckIntervalMinutes: 5,
  /** Days a logically deleted record is kept before the daily cron purges it. */
  deletedRetentionDays: 14,
} as const
