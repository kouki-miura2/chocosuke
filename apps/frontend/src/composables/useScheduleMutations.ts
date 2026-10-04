import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import type { Scope } from '../api/types.ts'
import { useSyncingMutation } from './useSyncingMutation.ts'

/** Schedules, their order and their topics (docs/spec.md "予定"). */
export const useScheduleMutations = () => ({
  create: useSyncingMutation((input: { scope: Scope; name: string; color: string }) =>
    call(apiClient.api.schedules.$post({ json: input })),
  ),
  update: useSyncingMutation(({ id, ...json }: { id: string; name: string; color: string }) =>
    call(apiClient.api.schedules[':id'].$patch({ param: { id }, json })),
  ),
  remove: useSyncingMutation((id: string) =>
    call(apiClient.api.schedules[':id'].$delete({ param: { id } })),
  ),
  saveOrder: useSyncingMutation((scheduleIds: string[]) =>
    call(apiClient.api.me['schedule-order'].$put({ json: { scheduleIds } })),
  ),
  renameTopic: useSyncingMutation(({ id, name }: { id: string; name: string }) =>
    call(apiClient.api.topics[':id'].$patch({ param: { id }, json: { name } })),
  ),
  removeTopic: useSyncingMutation((id: string) =>
    call(apiClient.api.topics[':id'].$delete({ param: { id } })),
  ),
})
