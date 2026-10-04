import { LIMITS } from 'utils'

import { AppError } from '../errors.ts'
import {
  type StoreRepository,
  type User,
  insert,
  joinGroup,
  leaveGroup,
  update,
} from '../repository/store.repository.ts'
import { type Runtime, groupOwner, newToken, requireGroupId, requireUser } from './context.ts'
import { deleteGroupWrite, leaveWrite } from './membership.ts'

export interface InviteView {
  token: string
  expiresAt: number
}

export interface GroupService {
  /** Creates a group with the user as its creator and first member. */
  createGroup: (
    userId: string,
    input: { name: string; memberName: string },
  ) => Promise<{ id: string }>
  renameGroup: (userId: string, name: string) => Promise<void>
  /** Issues a new invite link; the previous one stops working. */
  reissueInvite: (userId: string) => Promise<InviteView>
  /** What the join screen shows for an invite link. */
  getInvite: (userId: string, token: string) => Promise<{ groupName: string }>
  joinGroup: (userId: string, token: string, memberName: string) => Promise<{ id: string }>
  renameMember: (userId: string, memberName: string) => Promise<void>
  leaveGroup: (userId: string) => Promise<void>
  removeMember: (userId: string, memberId: string) => Promise<void>
  deleteGroup: (userId: string) => Promise<void>
}

export const createGroupService = (store: StoreRepository, runtime: Runtime): GroupService => {
  const inviteExpiry = (now: number) => now + LIMITS.inviteExpiryHours * 60 * 60 * 1000

  /** The user's group, requiring them to be its creator when `creatorOnly`. */
  const requireGroup = async (user: User, creatorOnly: boolean) => {
    const group = await store.findGroup(requireGroupId(user))
    if (!group) throw new AppError('NOT_IN_GROUP')
    if (creatorOnly && group.ownerUserId !== user.id) throw new AppError('FORBIDDEN')
    return group
  }

  const assertMemberNameFree = (members: User[], memberName: string, exceptUserId?: string) => {
    if (members.some((member) => member.memberName === memberName && member.id !== exceptUserId)) {
      throw new AppError('DUPLICATE_NAME')
    }
  }

  /** A usable invite: live group, unexpired token. */
  const requireInvite = async (token: string) => {
    const group = await store.findGroupByInviteToken(token)
    if (!group || group.inviteExpiresAt <= runtime.now()) throw new AppError('INVITE_INVALID')
    return group
  }

  return {
    createGroup: async (userId, input) => {
      const user = await requireUser(store, userId)
      if (user.groupId !== null) throw new AppError('ALREADY_IN_GROUP')
      const id = runtime.newId()
      const now = runtime.now()
      await store.commit(
        [],
        [
          insert('groups', {
            id,
            name: input.name,
            ownerUserId: user.id,
            inviteToken: newToken(),
            inviteExpiresAt: inviteExpiry(now),
            createdAt: now,
          }),
          update(
            'users',
            { id: user.id },
            { groupId: id, memberName: input.memberName, joinedAt: now },
          ),
        ],
      )
      return { id }
    },

    renameGroup: async (userId, name) => {
      const group = await requireGroup(await requireUser(store, userId), true)
      await store.commit([groupOwner(group.id)], [update('groups', { id: group.id }, { name })])
    },

    reissueInvite: async (userId) => {
      const group = await requireGroup(await requireUser(store, userId), false)
      const invite = { token: newToken(), expiresAt: inviteExpiry(runtime.now()) }
      await store.commit(
        [groupOwner(group.id)],
        [
          update(
            'groups',
            { id: group.id },
            { inviteToken: invite.token, inviteExpiresAt: invite.expiresAt },
          ),
        ],
      )
      return invite
    },

    getInvite: async (userId, token) => {
      await requireUser(store, userId)
      const group = await requireInvite(token)
      return { groupName: group.name }
    },

    joinGroup: async (userId, token, memberName) => {
      const user = await requireUser(store, userId)
      if (user.groupId !== null) throw new AppError('ALREADY_IN_GROUP')
      const group = await requireInvite(token)
      const members = await store.listMembers(group.id)
      assertMemberNameFree(members, memberName)
      if (members.length >= LIMITS.groupMembers) {
        throw new AppError('LIMIT_EXCEEDED', { limit: 'groupMembers' })
      }
      const [changed] = await store.commit(
        [groupOwner(group.id)],
        [joinGroup(user.id, group.id, memberName, runtime.now(), LIMITS.groupMembers)],
      )
      // Someone else took the last seat between the count above and this write.
      if (changed === 0) throw new AppError('LIMIT_EXCEEDED', { limit: 'groupMembers' })
      return { id: group.id }
    },

    renameMember: async (userId, memberName) => {
      const user = await requireUser(store, userId)
      const groupId = requireGroupId(user)
      assertMemberNameFree(await store.listMembers(groupId), memberName, user.id)
      await store.commit([groupOwner(groupId)], [update('users', { id: user.id }, { memberName })])
    },

    leaveGroup: async (userId) => {
      const user = await requireUser(store, userId)
      const write = await leaveWrite(store, user, requireGroupId(user), runtime.now())
      await store.commit(write.bumps, write.mutations)
    },

    removeMember: async (userId, memberId) => {
      const group = await requireGroup(await requireUser(store, userId), true)
      if (memberId === userId) throw new AppError('VALIDATION', { message: 'use leave instead' })
      const members = await store.listMembers(group.id)
      if (!members.some((member) => member.id === memberId)) throw new AppError('NOT_FOUND')
      await store.commit([groupOwner(group.id)], [leaveGroup({ id: memberId })])
    },

    deleteGroup: async (userId) => {
      const group = await requireGroup(await requireUser(store, userId), true)
      const write = deleteGroupWrite(group.id, runtime.now())
      await store.commit(write.bumps, write.mutations)
    },
  }
}
