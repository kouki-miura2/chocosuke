import { PUBLIC_PATHS, createApp } from 'backend/src/app.ts'
import { type GoogleVerifier, createGoogleVerifier } from 'backend/src/auth/google.ts'
import { createSessionCodec } from 'backend/src/auth/session.ts'
import { createSampleDao } from 'backend/src/dao/sample.memory.ts'
import { createJobs } from 'backend/src/jobs.ts'
import { type PushSender, createWebPushSender } from 'backend/src/push/web-push.ts'
import { createSessionAuthGuard } from 'backend/src/repository/auth-guard.session.ts'
import { createJobRepository } from 'backend/src/repository/job.repository.ts'
import { createSampleRepository } from 'backend/src/repository/sample.repository.ts'
import { createStoreRepository } from 'backend/src/repository/store.repository.ts'
import { createSyncRepository } from 'backend/src/repository/sync.repository.ts'
import { createAccountService } from 'backend/src/service/account.service.ts'
import { type Runtime, defaultRuntime } from 'backend/src/service/context.ts'
import { createEventService } from 'backend/src/service/event.service.ts'
import { createGroupService } from 'backend/src/service/group.service.ts'
import { createImageService } from 'backend/src/service/image.service.ts'
import { createPushService } from 'backend/src/service/push.service.ts'
import { createSampleService } from 'backend/src/service/sample.service.ts'
import { createScheduleService } from 'backend/src/service/schedule.service.ts'
import { createSyncService } from 'backend/src/service/sync.service.ts'

import { createImageStore } from './dao/image-store.r2.ts'
import { createJobDao } from './dao/job.d1.ts'
import { createPushSubscriptionDao } from './dao/push-subscription.d1.ts'
import { createReadDao } from './dao/read.d1.ts'
import { createSyncDao } from './dao/sync.d1.ts'
import { createWriteDao } from './dao/write.d1.ts'

/** Bindings and vars from `wrangler.jsonc`, plus the secrets (`wrangler secret put`). */
export type WorkerEnv = Env & { SESSION_SECRET: string; VAPID_PRIVATE_KEY: string }

/** Replaceable in tests: the clock and the outside services. */
export interface BuildOverrides {
  runtime?: Runtime
  google?: GoogleVerifier
  push?: PushSender
}

/** Wires DAO -> repository -> service; the worker does it once per isolate (`env` doesn't change within one). */
export const build = (env: WorkerEnv, overrides: BuildOverrides = {}) => {
  const runtime = overrides.runtime ?? defaultRuntime
  const store = createStoreRepository(createReadDao(env.DB), createWriteDao(env.DB))
  const jobRepository = createJobRepository(createJobDao(env.DB), createPushSubscriptionDao(env.DB))
  const images = createImageStore(env.IMAGES)
  const session = createSessionCodec(env.SESSION_SECRET, runtime.now)

  const app = createApp({
    accountService: createAccountService(store, runtime),
    scheduleService: createScheduleService(store, runtime),
    eventService: createEventService(store, images, runtime),
    imageService: createImageService(store, images, runtime),
    groupService: createGroupService(store, runtime),
    syncService: createSyncService(store, createSyncRepository(createSyncDao(env.DB))),
    pushService: createPushService(store, jobRepository, runtime),
    sampleService: createSampleService(createSampleRepository(createSampleDao())),
    google: overrides.google ?? createGoogleVerifier(env.GOOGLE_CLIENT_ID),
    session,
    auth: { guard: createSessionAuthGuard(session), enabled: true, excludePaths: PUBLIC_PATHS },
  })

  const jobs = createJobs({
    jobs: jobRepository,
    images,
    push:
      overrides.push ??
      createWebPushSender(
        {
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT,
        },
        runtime.now,
      ),
    now: runtime.now,
  })

  return { app, jobs }
}

let built: ReturnType<typeof build> | undefined
const get = (env: WorkerEnv) => (built ??= build(env))

export default {
  fetch: (request, env, ctx) => get(env).app.fetch(request, env, ctx),
  scheduled: async (controller, env, ctx) => {
    const { jobs } = get(env)
    // Crons from wrangler.jsonc "triggers".
    ctx.waitUntil(controller.cron === '0 18 * * *' ? jobs.purgeDeleted() : jobs.sendNotifications())
  },
} satisfies ExportedHandler<WorkerEnv>
