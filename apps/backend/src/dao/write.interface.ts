import type { Scope } from './records.ts'

/** A sync unit (docs/spec.md "データ取得・同期"): a user's personal data or a group's data. */
export interface Owner {
  scope: Scope
  /** users.id for `personal`, groups.id for `group`. */
  id: string
}

export type Table = 'users' | 'groups' | 'schedules' | 'topics' | 'events' | 'event_images'

export type SqlValue = string | number | null

/**
 * One statement of a write. Column names come from code, never from input; values are bound.
 * `where` matches by equality, with `null` meaning `IS NULL`. `revOf` sets the row's `rev` to the
 * owner's revision after this write's bump.
 */
export type Mutation =
  | { kind: 'insert'; table: Table; values: Record<string, SqlValue>; revOf?: Owner }
  | {
      kind: 'update'
      table: Table
      where: Record<string, SqlValue>
      set: Record<string, SqlValue>
      revOf?: Owner
    }
  /**
   * Puts a user into a group only while the group has fewer than `maxMembers` live members, so
   * concurrent joins can't exceed the limit. Changes 0 rows when the group is full.
   */
  | {
      kind: 'joinGroup'
      userId: string
      groupId: string
      memberName: string
      joinedAt: number
      maxMembers: number
    }

export interface WriteDao {
  /**
   * Runs one operation atomically (one D1 `batch`): first adds 1 to the revision of every owner
   * in `bumps`, then runs `mutations` in order. Returns the number of rows each mutation changed.
   */
  commit: (bumps: Owner[], mutations: Mutation[]) => Promise<number[]>
}
