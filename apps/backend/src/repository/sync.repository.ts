import type { SyncDao } from '../dao/sync.interface.ts'
import { camelize } from './case.ts'
import type { Event, EventImage, Owner, Schedule, Topic } from './store.repository.ts'

export interface Changes {
  schedules: Schedule[]
  topics: Topic[]
  events: Event[]
  images: EventImage[]
}

export interface SyncRepository {
  /** See `SyncDao.readChanges`. */
  readChanges: (owner: Owner, sinceRev: number | null) => Promise<Changes>
}

export const createSyncRepository = (dao: SyncDao): SyncRepository => ({
  readChanges: async (owner, sinceRev) => {
    const changes = await dao.readChanges(owner, sinceRev)
    return {
      schedules: changes.schedules.map(camelize),
      topics: changes.topics.map(camelize),
      events: changes.events.map(camelize),
      images: changes.images.map(camelize),
    }
  },
})
