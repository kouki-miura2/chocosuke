import { TERMS_VERSION } from 'utils'

import { AppError } from '../errors.ts'
import {
  type StoreRepository,
  insert,
  softDeleteTree,
  update,
} from '../repository/store.repository.ts'
import { type Runtime, personalOwner, requireUser } from './context.ts'
import { leaveWrite } from './membership.ts'

export interface Session {
  userId: string
  termsVersion: string
}

export interface MeView {
  id: string
  /** The user still has to agree to the current terms (`TERMS_VERSION`). */
  needsConsent: boolean
  groupId: string | null
}

export interface AccountService {
  /** The session of a verified Google account's user, or `null` if it isn't registered yet. */
  login: (googleSub: string) => Promise<Session | null>
  /**
   * Registers the user of a verified Google account who agreed to `termsVersion` (it must be the
   * current one). Registering an already registered account just signs it in.
   */
  register: (googleSub: string, termsVersion: string) => Promise<Session>
  agreeToTerms: (userId: string) => Promise<Session>
  getMe: (userId: string) => Promise<MeView>
  /** Withdraws: deletes the personal data, leaves the group, marks the user deleted. */
  withdraw: (userId: string) => Promise<void>
  /** Saves the schedule order; ids the user can't see are dropped. */
  setScheduleOrder: (userId: string, scheduleIds: string[]) => Promise<void>
}

export const createAccountService = (store: StoreRepository, runtime: Runtime): AccountService => ({
  login: async (googleSub) => {
    const existing = await store.findUserByGoogleSub(googleSub)
    return existing && { userId: existing.id, termsVersion: existing.agreedTermsVersion }
  },

  register: async (googleSub, termsVersion) => {
    if (termsVersion !== TERMS_VERSION) throw new AppError('VALIDATION')
    const existing = await store.findUserByGoogleSub(googleSub)
    if (existing) return { userId: existing.id, termsVersion: existing.agreedTermsVersion }

    const id = runtime.newId()
    try {
      await store.commit(
        [],
        [
          insert('users', {
            id,
            googleSub,
            agreedTermsVersion: TERMS_VERSION,
            createdAt: runtime.now(),
          }),
        ],
      )
    } catch (error) {
      // A concurrent registration of the same account won the unique index; use that user.
      const winner = await store.findUserByGoogleSub(googleSub)
      if (!winner) throw error
      return { userId: winner.id, termsVersion: winner.agreedTermsVersion }
    }
    return { userId: id, termsVersion: TERMS_VERSION }
  },

  agreeToTerms: async (userId) => {
    await requireUser(store, userId)
    await store.commit([], [update('users', { id: userId }, { agreedTermsVersion: TERMS_VERSION })])
    return { userId, termsVersion: TERMS_VERSION }
  },

  getMe: async (userId) => {
    const user = await requireUser(store, userId)
    return {
      id: user.id,
      needsConsent: user.agreedTermsVersion < TERMS_VERSION,
      groupId: user.groupId,
    }
  },

  withdraw: async (userId) => {
    const user = await requireUser(store, userId)
    const now = runtime.now()
    const leave = user.groupId
      ? await leaveWrite(store, user, user.groupId, now)
      : { bumps: [], mutations: [] }
    const owner = personalOwner(user)
    await store.commit(
      [owner, ...leave.bumps],
      [
        ...leave.mutations,
        ...softDeleteTree({ ownerId: user.id }, now, owner),
        update('users', { id: user.id }, { deletedAt: now }),
      ],
    )
  },

  setScheduleOrder: async (userId, scheduleIds) => {
    const user = await requireUser(store, userId)
    const visible = new Set(
      [
        ...(await store.listSchedules(user.id)),
        ...(user.groupId ? await store.listSchedules(user.groupId) : []),
      ].map((schedule) => schedule.id),
    )
    const order = [...new Set(scheduleIds)].filter((id) => visible.has(id))
    await store.commit(
      [personalOwner(user)],
      [update('users', { id: user.id }, { scheduleOrder: JSON.stringify(order) })],
    )
  },
})
