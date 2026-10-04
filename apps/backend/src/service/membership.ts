import type { Mutation } from '../dao/write.interface.ts'
import {
  type Owner,
  type StoreRepository,
  type User,
  leaveGroup,
  softDeleteTree,
  update,
} from '../repository/store.repository.ts'
import { groupOwner } from './context.ts'

export interface Write {
  bumps: Owner[]
  mutations: Mutation[]
}

/** Deletes a group with everything in it and takes every member out of it. */
export const deleteGroupWrite = (groupId: string, now: number): Write => ({
  bumps: [groupOwner(groupId)],
  mutations: [
    update('groups', { id: groupId, deletedAt: null }, { deletedAt: now }),
    ...softDeleteTree({ ownerId: groupId }, now, groupOwner(groupId)),
    leaveGroup({ groupId }),
  ],
})

/**
 * Takes `user` out of their group (leaving or withdrawing). When the creator leaves, the member
 * who joined earliest becomes the creator; when nobody is left, the group is deleted
 * (docs/spec.md "権限" ※).
 */
export const leaveWrite = async (
  store: StoreRepository,
  user: User,
  groupId: string,
  now: number,
): Promise<Write> => {
  const group = await store.findGroup(groupId)
  const leave = { bumps: [groupOwner(groupId)], mutations: [leaveGroup({ id: user.id })] }
  if (!group || group.ownerUserId !== user.id) return leave

  const successor = (await store.listMembers(groupId)).find((member) => member.id !== user.id)
  if (!successor) return deleteGroupWrite(groupId, now)
  return {
    bumps: leave.bumps,
    mutations: [
      update('groups', { id: groupId }, { ownerUserId: successor.id }),
      ...leave.mutations,
    ],
  }
}
