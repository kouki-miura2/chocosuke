import { useQuery } from '@tanstack/vue-query'
import { type MaybeRefOrGetter, toValue } from 'vue'

import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import { useSyncingMutation } from './useSyncingMutation.ts'

/** The group (docs/spec.md "グループ"); its data reaches the screen through the next sync. */
export const useGroupMutations = () => {
  const current = apiClient.api.groups.current
  return {
    create: useSyncingMutation((json: { name: string; memberName: string }) =>
      call(apiClient.api.groups.$post({ json })),
    ),
    rename: useSyncingMutation((name: string) => call(current.$patch({ json: { name } }))),
    reissueInvite: useSyncingMutation(() => call(current.invite.$post())),
    renameMember: useSyncingMutation((memberName: string) =>
      call(current.members.me.$patch({ json: { memberName } })),
    ),
    leave: useSyncingMutation(() => call(current.members.me.$delete())),
    removeMember: useSyncingMutation((userId: string) =>
      call(current.members[':userId'].$delete({ param: { userId } })),
    ),
    remove: useSyncingMutation(() => call(current.$delete())),
    join: useSyncingMutation(({ token, memberName }: { token: string; memberName: string }) =>
      call(apiClient.api.invites[':token'].join.$post({ param: { token }, json: { memberName } })),
    ),
  }
}

/** The group an invite link leads to (`GET /api/invites/:token`). */
export const useInviteQuery = (token: MaybeRefOrGetter<string>) =>
  useQuery({
    queryKey: ['invite', token],
    queryFn: () => call(apiClient.api.invites[':token'].$get({ param: { token: toValue(token) } })),
    // Shown on the join screen instead of a snackbar.
    meta: { quiet: true },
  })
