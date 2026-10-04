import { LIMITS, createLogger } from 'utils'

import type { ImageStore } from './dao/image-store.interface.ts'
import type { PushSender } from './push/web-push.ts'
import type { DueEvent, JobRepository } from './repository/job.repository.ts'

/** Notifications whose time passed longer ago than this are dropped, not sent late. */
const staleAfterMs = 10 * 60 * 1000
/** Due events handled per run; the rest wait for the next minute. */
const batchSize = 100

const weekdays = ['日', '月', '火', '水', '木', '金', '土']

/** `10/5（月）10:00 · 仕事` (all-day: without the time). */
export const notificationBody = (event: DueEvent): string => {
  const [year, month, day] = event.startDate.split('-').map(Number)
  const weekday = weekdays[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  const time = event.startTime ? ` ${event.startTime}` : ''
  return `${month}/${day}（${weekday}）${time} · ${event.scheduleName}`
}

export interface Jobs {
  /** Every minute: sends due event notifications (docs/spec.md "通知"). */
  sendNotifications: () => Promise<void>
  /** Daily: physically deletes data logically deleted `LIMITS.deletedRetentionDays` days ago. */
  purgeDeleted: () => Promise<void>
}

export const createJobs = (deps: {
  jobs: JobRepository
  images: ImageStore
  push: PushSender
  now: () => number
}): Jobs => {
  const logger = createLogger({ format: 'json' })

  return {
    sendNotifications: async () => {
      const now = deps.now()
      const due = await deps.jobs.listDueEvents(now, batchSize)
      if (due.length === 0) return

      const gone: string[] = []
      for (const event of due.filter((event) => now - event.notifyAt <= staleAfterMs)) {
        const subscriptions = await deps.jobs.listSubscriptions(event.scope, event.ownerId)
        const payload = JSON.stringify({
          title: event.title,
          body: notificationBody(event),
          eventId: event.id,
        })
        const results = await Promise.all(
          subscriptions.map((subscription) => deps.push.send(subscription, payload)),
        )
        results.forEach((result, index) => {
          if (result === 'gone') gone.push(subscriptions[index].id)
        })
      }
      if (gone.length > 0) await deps.jobs.deleteSubscriptions(gone)
      await deps.jobs.clearNotifyAt(due.map((event) => event.id))
      logger.info('notifications sent', { events: due.length, goneSubscriptions: gone.length })
    },

    purgeDeleted: async () => {
      const cutoff = deps.now() - LIMITS.deletedRetentionDays * 24 * 60 * 60 * 1000
      const imageIds = await deps.jobs.listPurgeableImageIds(cutoff)
      // Objects first: a row whose object is gone is harmless, an orphaned object is not findable.
      await deps.images.delete(imageIds)
      await deps.jobs.purge(cutoff)
      logger.info('deleted data purged', { images: imageIds.length })
    },
  }
}
