import { LIMITS, charLength, isDateString, isTimeString } from 'utils'
import { z } from 'zod'

// Request shapes. Strings are trimmed (docs/spec.md "共通ルール > 入力") and length-checked with
// `charLength`; rules across fields (dates, limits by count) are the services' job.

/** Required text: trimmed, not empty, at most `max` visible characters. */
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .refine((value) => charLength(value) <= max)

/** Optional text: trimmed; empty means `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .refine((value) => charLength(value) <= max)
    .nullable()
    .transform((value) => (value ? value : null))

const date = z.string().refine(isDateString)
const time = z.string().refine(isTimeString)
const id = z.string().min(1).max(64)

export const loginSchema = z.object({ credential: z.string().min(1) })

export const scheduleSchema = z.object({
  scope: z.enum(['personal', 'group']),
  name: text(LIMITS.scheduleNameMaxLength),
  /** Key of one of the frontend's 12 schedule colors. */
  color: z.string().regex(/^[a-z0-9-]{1,32}$/),
})

export const scheduleUpdateSchema = scheduleSchema.omit({ scope: true })

export const scheduleOrderSchema = z.object({
  scheduleIds: z.array(id).max(LIMITS.personalSchedules + LIMITS.groupSchedules),
})

export const topicSchema = z.object({ name: text(LIMITS.topicNameMaxLength) })

export const eventSchema = z.object({
  scheduleId: id,
  topicName: optionalText(LIMITS.topicNameMaxLength),
  title: text(LIMITS.eventTitleMaxLength),
  allDay: z.boolean(),
  startDate: date,
  startTime: time.nullable(),
  endDate: date,
  endTime: time.nullable(),
  notifyMinutes: z.number().int().nullable(),
  memo: optionalText(LIMITS.eventMemoMaxLength),
})

export const imageQuerySchema = z.object({
  width: z.coerce.number().int().min(1).max(LIMITS.imageMaxPx),
  height: z.coerce.number().int().min(1).max(LIMITS.imageMaxPx),
})

export const groupSchema = z.object({
  name: text(LIMITS.groupNameMaxLength),
  memberName: text(LIMITS.memberNameMaxLength),
})

export const groupNameSchema = z.object({ name: text(LIMITS.groupNameMaxLength) })

export const memberNameSchema = z.object({ memberName: text(LIMITS.memberNameMaxLength) })

export const syncQuerySchema = z.object({
  personalRev: z.coerce.number().int().min(0).optional(),
  groupId: id.optional(),
  groupRev: z.coerce.number().int().min(0).optional(),
})

/**
 * Hosts of the browsers' push services. The server POSTs to a subscription's endpoint, so any
 * other URL is refused to keep the API from being used to send requests elsewhere.
 */
const pushServiceHosts = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
]

const pushEndpoint = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const url = new URL(value)
      return url.protocol === 'https:' && pushServiceHosts.some((host) => host.test(url.hostname))
    } catch {
      return false
    }
  })

const base64Url = z.string().regex(/^[A-Za-z0-9_-]+$/)

export const subscriptionSchema = z.object({
  endpoint: pushEndpoint,
  p256dh: base64Url.max(128),
  auth: base64Url.max(64),
})

export const endpointSchema = z.object({ endpoint: z.string().max(2048).optional() })
