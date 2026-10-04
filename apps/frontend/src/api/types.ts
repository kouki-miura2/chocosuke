import type { InferResponseType } from 'hono/client'

import type { Success } from './call.ts'
import type { apiClient } from './client.ts'

// Shapes of the API's data, inferred from the backend through Hono RPC — never written by hand.

export type SyncResponse = Success<InferResponseType<typeof apiClient.api.sync.$get>>
type Unit = NonNullable<SyncResponse['personal']>
type GroupUnit = NonNullable<SyncResponse['group']>

export type Schedule = Unit['schedules'][number]
export type Topic = Unit['topics'][number]
export type CalendarEvent = Unit['events'][number]
export type EventImage = Unit['images'][number]
export type GroupInfo = GroupUnit['info']
export type Member = GroupUnit['members'][number]
export type Scope = Schedule['scope']

export type EventInput = Parameters<typeof apiClient.api.events.$post>[0]['json']
export type Me = Success<InferResponseType<typeof apiClient.api.me.$get>>
