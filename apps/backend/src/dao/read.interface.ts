import type {
  EventRecord,
  GroupRecord,
  ImageRecord,
  ScheduleRecord,
  TopicRecord,
  UserRecord,
} from './records.ts'

/**
 * Single-row and small-list reads used by the services. Every method returns live rows only
 * (`deleted_at IS NULL`), except `findUser`, which also returns a withdrawn user so a stale
 * session can be told apart from an unknown id.
 */
export interface ReadDao {
  findUser: (id: string) => Promise<UserRecord | null>
  findUserByGoogleSub: (googleSub: string) => Promise<UserRecord | null>
  /** Members of a group, oldest join first. */
  listMembers: (groupId: string) => Promise<UserRecord[]>
  findGroup: (id: string) => Promise<GroupRecord | null>
  findGroupByInviteToken: (token: string) => Promise<GroupRecord | null>
  findSchedule: (id: string) => Promise<ScheduleRecord | null>
  listSchedules: (ownerId: string) => Promise<ScheduleRecord[]>
  findTopic: (id: string) => Promise<TopicRecord | null>
  listTopics: (scheduleId: string) => Promise<TopicRecord[]>
  findEvent: (id: string) => Promise<EventRecord | null>
  /** Events of a schedule whose start date is within `[fromDate, toDate]` (for the per-day count). */
  listEventsStartingBetween: (
    scheduleId: string,
    fromDate: string,
    toDate: string,
  ) => Promise<EventRecord[]>
  findImage: (id: string) => Promise<ImageRecord | null>
  /** Images of an event in display order. */
  listImages: (eventId: string) => Promise<ImageRecord[]>
  /** Total bytes of an owner's (user's or group's) images. */
  sumImageBytes: (ownerId: string) => Promise<number>
}
