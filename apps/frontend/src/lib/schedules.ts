import type { Schedule } from '../api/types.ts'

/**
 * Schedules in the user's order (docs/spec.md "予定 > 一覧"): the saved order first, then the ones
 * it doesn't list (new, or created by another member) by creation time.
 */
export const orderSchedules = (schedules: Schedule[], order: string[]): Schedule[] => {
  const position = new Map(order.map((id, index) => [id, index]))
  return [...schedules].sort((a, b) => {
    const pa = position.get(a.id)
    const pb = position.get(b.id)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return a.createdAt - b.createdAt
  })
}

/** The ids with the one at `from` moved to `to` (a drag in the schedule list). */
export const moveId = (ids: string[], from: number, to: number): string[] => {
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
