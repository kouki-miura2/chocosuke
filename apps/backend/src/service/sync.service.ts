import { AppError } from '../errors.ts'
import type { Event, Owner, StoreRepository } from '../repository/store.repository.ts'
import type { Changes, SyncRepository } from '../repository/sync.repository.ts'
import { groupOwner, personalOwner, requireUser } from './context.ts'

/** What the client holds (docs/spec.md "データ取得・同期 > 同期API"); omitted = nothing yet. */
export interface SyncRequest {
  personalRev?: number
  groupId?: string
  groupRev?: number
}

/** The rows of one sync unit; `full` replaces what the client holds, otherwise it's a delta. */
type UnitView = Omit<Changes, 'events'> & {
  /** The revision to send next time. */
  rev: number
  full: boolean
  /** `notifyAt` is server-only. */
  events: Omit<Changes['events'][number], 'notifyAt'>[]
}

export interface SyncView {
  /** The user's group now; the client drops its group data when this differs from what it holds. */
  groupId: string | null
  /** `null` when unchanged. */
  personal: (UnitView & { scheduleOrder: string[] }) | null
  /** `null` when unchanged or not in a group. */
  group:
    | (UnitView & {
        info: {
          id: string
          name: string
          ownerUserId: string
          inviteToken: string
          inviteExpiresAt: number
        }
        members: { userId: string; memberName: string; joinedAt: number }[]
      })
    | null
}

export interface SyncService {
  sync: (userId: string, request: SyncRequest) => Promise<SyncView>
}

/** Events as the client sees them: `notifyAt` is for the notification job only. */
const withoutNotifyAt = (event: Event): Omit<Event, 'notifyAt'> => {
  const view: Partial<Event> = { ...event }
  delete view.notifyAt
  return view as Omit<Event, 'notifyAt'>
}

type Plan = { kind: 'unchanged' } | { kind: 'delta'; since: number } | { kind: 'full' }

/**
 * Full when the client has nothing, or its revision is behind `purgedRev` (deletions it would need
 * were purged) or ahead of the server's (it can't be trusted).
 */
const planFor = (clientRev: number | undefined, rev: number, purgedRev: number): Plan => {
  if (clientRev === undefined || clientRev < purgedRev || clientRev > rev) return { kind: 'full' }
  return clientRev === rev ? { kind: 'unchanged' } : { kind: 'delta', since: clientRev }
}

export const createSyncService = (store: StoreRepository, sync: SyncRepository): SyncService => {
  /**
   * `rev` is the revision read before the rows. Rows written in between may come along too, which is
   * harmless: the next sync asks from `rev` again and gets them (and anything newer) once more.
   * Answering with a revision read after the rows could skip writes the rows missed.
   */
  const read = async (owner: Owner, rev: number, plan: Plan): Promise<UnitView | null> => {
    if (plan.kind === 'unchanged') return null
    const changes = await sync.readChanges(owner, plan.kind === 'delta' ? plan.since : null)
    return {
      ...changes,
      rev,
      events: changes.events.map(withoutNotifyAt),
      full: plan.kind === 'full',
    }
  }

  return {
    sync: async (userId, request) => {
      const user = await requireUser(store, userId)

      const personal = await read(
        personalOwner(user),
        user.rev,
        planFor(request.personalRev, user.rev, user.purgedRev),
      )

      let group: SyncView['group'] = null
      if (user.groupId !== null) {
        const info = await store.findGroup(user.groupId)
        if (!info) throw new AppError('NOT_IN_GROUP')
        const plan =
          request.groupId === user.groupId
            ? planFor(request.groupRev, info.rev, info.purgedRev)
            : ({ kind: 'full' } as const)
        const unit = await read(groupOwner(info.id), info.rev, plan)
        if (unit) {
          const members = await store.listMembers(info.id)
          group = {
            ...unit,
            info: {
              id: info.id,
              name: info.name,
              ownerUserId: info.ownerUserId,
              inviteToken: info.inviteToken,
              inviteExpiresAt: info.inviteExpiresAt,
            },
            members: members.map((member) => ({
              userId: member.id,
              memberName: member.memberName ?? '',
              joinedAt: member.joinedAt ?? 0,
            })),
          }
        }
      }

      return {
        groupId: user.groupId,
        personal: personal && { ...personal, scheduleOrder: user.scheduleOrder },
        group,
      }
    },
  }
}
