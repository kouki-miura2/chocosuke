import { AppError } from '../errors.ts'
import type { Owner, StoreRepository, User } from '../repository/store.repository.ts'

/** Time and id sources, injected so tests can pin them. */
export interface Runtime {
  now: () => number
  newId: () => string
}

export const defaultRuntime: Runtime = { now: () => Date.now(), newId: () => crypto.randomUUID() }

/** The signed-in user, read fresh on every call; a withdrawn user's session no longer works. */
export const requireUser = async (store: StoreRepository, userId: string): Promise<User> => {
  const user = await store.findUser(userId)
  if (!user || user.deletedAt !== null) throw new AppError('UNAUTHORIZED')
  return user
}

/** The user's group id, or `NOT_IN_GROUP`. */
export const requireGroupId = (user: User): string => {
  if (user.groupId === null) throw new AppError('NOT_IN_GROUP')
  return user.groupId
}

/** Whether data owned by `ownerId` (a user or group id) is the user's own or their group's. */
export const canAccess = (user: User, ownerId: string): boolean =>
  ownerId === user.id || (user.groupId !== null && ownerId === user.groupId)

/**
 * Data the user can't see is reported as not found rather than forbidden, so ids of other users'
 * data can't be probed.
 */
export const assertAccess = (user: User, ownerId: string): void => {
  if (!canAccess(user, ownerId)) throw new AppError('NOT_FOUND')
}

export const personalOwner = (user: User): Owner => ({ scope: 'personal', id: user.id })

export const groupOwner = (groupId: string): Owner => ({ scope: 'group', id: groupId })

/** The sync unit of data owned by `ownerId`, which the user can access (see `assertAccess`). */
export const ownerFor = (user: User, ownerId: string): Owner =>
  ownerId === user.id ? personalOwner(user) : groupOwner(ownerId)

/** The sync unit a schedule belongs to. */
export const ownerOf = (schedule: { scope: Owner['scope']; ownerId: string }): Owner => ({
  scope: schedule.scope,
  id: schedule.ownerId,
})

/** A random token for invite links: 32 bytes, base64url. */
export const newToken = (): string =>
  btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
