import { zValidator } from '@hono/zod-validator'
import { type Context, Hono } from 'hono'
import { deleteCookie, setCookie } from 'hono/cookie'
import { csrf } from 'hono/csrf'
import { HTTPException } from 'hono/http-exception'
import { TERMS_VERSION, createLogger } from 'utils'
import type { z } from 'zod'

import type { GoogleVerifier } from './auth/google.ts'
import {
  SESSION_COOKIE,
  type SessionClaims,
  type SessionCodec,
  sessionMaxAgeSeconds,
} from './auth/session.ts'
import { AppError, ERROR_STATUS } from './errors.ts'
import type { AuthGuard, AuthenticatedUser } from './repository/auth-guard.interface.ts'
import type { AccountService } from './service/account.service.ts'
import type { EventService } from './service/event.service.ts'
import type { GroupService } from './service/group.service.ts'
import type { ImageService } from './service/image.service.ts'
import type { PushService } from './service/push.service.ts'
import type { ScheduleService } from './service/schedule.service.ts'
import type { SyncService } from './service/sync.service.ts'
import {
  endpointSchema,
  eventSchema,
  groupNameSchema,
  groupSchema,
  imageQuerySchema,
  loginSchema,
  registerSchema,
  memberNameSchema,
  scheduleOrderSchema,
  scheduleSchema,
  scheduleUpdateSchema,
  subscriptionSchema,
  syncQuerySchema,
  topicSchema,
} from './validation.ts'

export interface AuthConfig {
  guard: AuthGuard
  /** Off by default (free access). When on, applies to every route except `excludePaths`. */
  enabled: boolean
  excludePaths: string[]
}

export interface AppDependencies {
  accountService: AccountService
  scheduleService: ScheduleService
  eventService: EventService
  imageService: ImageService
  groupService: GroupService
  syncService: SyncService
  pushService: PushService
  /** Template reference, still used by the template frontend; delete with it. */
  google: GoogleVerifier
  session: SessionCodec
  auth: AuthConfig
}

/** Paths reachable without a session. */
export const PUBLIC_PATHS = ['/api/auth/google', '/api/auth/register']

/**
 * Paths usable before agreeing to the current terms: what the consent screen itself needs, plus
 * ways out (logout, withdrawal, clearing the device).
 */
const CONSENT_FREE_PATHS = ['/api/me', '/api/auth/consent', '/api/auth/logout', '/api/device/clear']

type Variables = { user: AuthenticatedUser | null; requestId: string }

// 4 random bytes as hex: short enough to scan by eye in logs, still ~4 billion values so
// collisions within one log stream are practically a non-issue.
const generateRequestId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(4)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')

/** Validates a request part, answering `{ error: 'VALIDATION' }` (400) like the services do. */
const valid = <Target extends 'json' | 'query', Schema extends z.ZodType>(
  target: Target,
  schema: Schema,
) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) return c.json({ error: 'VALIDATION' as const }, 400)
  })

/** The signed-in user's id (the auth guard has already run). */
const userIdOf = (c: Context<{ Variables: Variables }>): string => {
  const user = c.get('user')
  if (!user) throw new AppError('UNAUTHORIZED')
  return user.id
}

/** Runtime-agnostic app: no Cloudflare Workers or Node-specific APIs here. Entrypoints live in the runtime package (`apps/backend-*`). */
export const createApp = (deps: AppDependencies) => {
  const logger = createLogger({ format: 'json' })

  const startSession = async (c: Context, claims: SessionClaims) => {
    setCookie(c, SESSION_COOKIE, await deps.session.issue(claims), {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: sessionMaxAgeSeconds,
    })
  }

  const endSession = (c: Context) => deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true })

  return (
    new Hono<{ Variables: Variables }>()
      // Served under /api on the same origin as the frontend (Vite proxies it in dev), so no CORS.
      .basePath('/api')
      // Audit trail: start/end pair per request, joined by requestId (needed since concurrent
      // requests to the same method+path would otherwise be indistinguishable in the log stream).
      // Wraps the auth guard so a rejected (401) request is still logged, not just successful ones.
      .use('*', async (c, next) => {
        const requestId = generateRequestId()
        c.set('requestId', requestId)
        const startedAt = Date.now()

        logger.info('request started', { requestId, method: c.req.method, path: c.req.path })

        try {
          await next()
        } finally {
          logger.info('request completed', {
            requestId,
            method: c.req.method,
            path: c.req.path,
            user: c.get('user')?.id ?? 'anonymous',
            status: c.res.status,
            durationMs: Date.now() - startedAt,
          })
        }
      })
      // Rejects cross-site form posts (the session cookie is SameSite=Lax as well).
      .use('*', csrf())
      .use('*', async (c, next) => {
        if (deps.auth.enabled && !deps.auth.excludePaths.includes(c.req.path)) {
          const user = await deps.auth.guard.authenticate(c.req.raw)
          if (!user) return c.json({ error: 'UNAUTHORIZED' }, 401)
          c.set('user', user)
          if (user.termsVersion < TERMS_VERSION && !CONSENT_FREE_PATHS.includes(c.req.path)) {
            return c.json({ error: 'CONSENT_REQUIRED' }, 403)
          }
        } else {
          c.set('user', null)
        }
        await next()
      })
      .onError((error, c) => {
        if (error instanceof AppError) {
          return c.json(
            { error: error.code, ...(error.limit && { limit: error.limit }) },
            ERROR_STATUS[error.code],
          )
        }
        if (error instanceof HTTPException) return error.getResponse()
        logger.error('unhandled error', {
          requestId: c.get('requestId'),
          error: error instanceof Error ? error.stack : String(error),
        })
        return c.json({ error: 'INTERNAL' }, 500)
      })

      // Auth and account (docs/spec.md "ログイン・同意", "設定")
      // Sign in first, consent and register after (root AGENTS.md "Sign in with Google and terms
      // consent"): an unregistered account gets no session until it registers.
      .post('/auth/google', valid('json', loginSchema), async (c) => {
        const googleSub = await deps.google.verify(c.req.valid('json').credential)
        if (!googleSub) throw new AppError('UNAUTHORIZED')
        const session = await deps.accountService.login(googleSub)
        if (!session) return c.json({ registered: false, needsConsent: true })
        await startSession(c, session)
        return c.json({ registered: true, needsConsent: session.termsVersion < TERMS_VERSION })
      })
      .post('/auth/register', valid('json', registerSchema), async (c) => {
        const { credential, termsVersion } = c.req.valid('json')
        const googleSub = await deps.google.verify(credential)
        if (!googleSub) throw new AppError('UNAUTHORIZED')
        await startSession(c, await deps.accountService.register(googleSub, termsVersion))
        return c.json({ ok: true })
      })
      .post('/auth/consent', async (c) => {
        await startSession(c, await deps.accountService.agreeToTerms(userIdOf(c)))
        return c.json({ ok: true })
      })
      .post('/auth/logout', (c) => {
        endSession(c)
        return c.json({ ok: true })
      })
      .get('/me', async (c) => c.json(await deps.accountService.getMe(userIdOf(c))))
      .delete('/me', async (c) => {
        await deps.accountService.withdraw(userIdOf(c))
        endSession(c)
        return c.json({ ok: true })
      })
      .put('/me/schedule-order', valid('json', scheduleOrderSchema), async (c) => {
        await deps.accountService.setScheduleOrder(userIdOf(c), c.req.valid('json').scheduleIds)
        return c.json({ ok: true })
      })

      // Sync (docs/spec.md "データ取得・同期")
      .get('/sync', valid('query', syncQuerySchema), async (c) =>
        c.json(await deps.syncService.sync(userIdOf(c), c.req.valid('query'))),
      )

      // Schedules and topics (docs/spec.md "予定")
      .post('/schedules', valid('json', scheduleSchema), async (c) =>
        c.json(await deps.scheduleService.createSchedule(userIdOf(c), c.req.valid('json')), 201),
      )
      .patch('/schedules/:id', valid('json', scheduleUpdateSchema), async (c) => {
        await deps.scheduleService.updateSchedule(
          userIdOf(c),
          c.req.param('id'),
          c.req.valid('json'),
        )
        return c.json({ ok: true })
      })
      .delete('/schedules/:id', async (c) => {
        await deps.scheduleService.deleteSchedule(userIdOf(c), c.req.param('id'))
        return c.json({ ok: true })
      })
      .patch('/topics/:id', valid('json', topicSchema), async (c) => {
        await deps.scheduleService.renameTopic(
          userIdOf(c),
          c.req.param('id'),
          c.req.valid('json').name,
        )
        return c.json({ ok: true })
      })
      .delete('/topics/:id', async (c) => {
        await deps.scheduleService.deleteTopic(userIdOf(c), c.req.param('id'))
        return c.json({ ok: true })
      })

      // Events and images (docs/spec.md "イベント")
      .post('/events', valid('json', eventSchema), async (c) =>
        c.json(await deps.eventService.createEvent(userIdOf(c), c.req.valid('json')), 201),
      )
      .patch('/events/:id', valid('json', eventSchema), async (c) =>
        c.json(
          await deps.eventService.updateEvent(userIdOf(c), c.req.param('id'), c.req.valid('json')),
        ),
      )
      .delete('/events/:id', async (c) => {
        await deps.eventService.deleteEvent(userIdOf(c), c.req.param('id'))
        return c.json({ ok: true })
      })
      .post('/events/:id/images', valid('query', imageQuerySchema), async (c) => {
        if (c.req.header('content-type') !== 'image/jpeg') throw new AppError('VALIDATION')
        const { width, height } = c.req.valid('query')
        const body = await c.req.arrayBuffer()
        return c.json(
          await deps.imageService.addImage(userIdOf(c), c.req.param('id'), { body, width, height }),
          201,
        )
      })
      .delete('/images/:id', async (c) => {
        await deps.imageService.deleteImage(userIdOf(c), c.req.param('id'))
        return c.json({ ok: true })
      })
      .get('/images/:id', async (c) => {
        const body = await deps.imageService.getImage(userIdOf(c), c.req.param('id'))
        return c.body(body, 200, {
          'Content-Type': 'image/jpeg',
          // Images never change (a new image gets a new id), and are only for this user.
          'Cache-Control': 'private, max-age=31536000, immutable',
        })
      })

      // Group (docs/spec.md "グループ")
      .post('/groups', valid('json', groupSchema), async (c) =>
        c.json(await deps.groupService.createGroup(userIdOf(c), c.req.valid('json')), 201),
      )
      .patch('/groups/current', valid('json', groupNameSchema), async (c) => {
        await deps.groupService.renameGroup(userIdOf(c), c.req.valid('json').name)
        return c.json({ ok: true })
      })
      .delete('/groups/current', async (c) => {
        await deps.groupService.deleteGroup(userIdOf(c))
        return c.json({ ok: true })
      })
      .post('/groups/current/invite', async (c) =>
        c.json(await deps.groupService.reissueInvite(userIdOf(c))),
      )
      .patch('/groups/current/members/me', valid('json', memberNameSchema), async (c) => {
        await deps.groupService.renameMember(userIdOf(c), c.req.valid('json').memberName)
        return c.json({ ok: true })
      })
      .delete('/groups/current/members/me', async (c) => {
        await deps.groupService.leaveGroup(userIdOf(c))
        return c.json({ ok: true })
      })
      .delete('/groups/current/members/:userId', async (c) => {
        await deps.groupService.removeMember(userIdOf(c), c.req.param('userId'))
        return c.json({ ok: true })
      })
      .get('/invites/:token', async (c) =>
        c.json(await deps.groupService.getInvite(userIdOf(c), c.req.param('token'))),
      )
      .post('/invites/:token/join', valid('json', memberNameSchema), async (c) =>
        c.json(
          await deps.groupService.joinGroup(
            userIdOf(c),
            c.req.param('token'),
            c.req.valid('json').memberName,
          ),
        ),
      )

      // Push notifications and this device (docs/spec.md "通知", "設定 > この端末のデータを消去")
      .post('/push-subscriptions', valid('json', subscriptionSchema), async (c) => {
        await deps.pushService.subscribe(userIdOf(c), c.req.valid('json'))
        return c.json({ ok: true }, 201)
      })
      .delete('/push-subscriptions', valid('json', endpointSchema), async (c) => {
        const { endpoint } = c.req.valid('json')
        if (endpoint) await deps.pushService.unsubscribe(userIdOf(c), endpoint)
        return c.json({ ok: true })
      })
      .post('/device/clear', valid('json', endpointSchema), async (c) => {
        const { endpoint } = c.req.valid('json')
        if (endpoint) await deps.pushService.unsubscribe(userIdOf(c), endpoint)
        endSession(c)
        // Image responses are in the browser's HTTP cache, which page scripts can't clear.
        c.header('Clear-Site-Data', '"cache"')
        return c.json({ ok: true })
      })
  )
}

/** Hono RPC contract consumed by `apps/frontend` via `hc<AppType>()`. */
export type AppType = ReturnType<typeof createApp>
