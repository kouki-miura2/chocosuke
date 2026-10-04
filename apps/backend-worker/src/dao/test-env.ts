import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getPlatformProxy } from 'wrangler'

const packageDir = join(dirname(fileURLToPath(import.meta.url)), '../..')

const migrations = ['0001_init.sql'].map((name) =>
  readFileSync(join(packageDir, 'migrations', name), 'utf8'),
)

const tables = [
  'event_images',
  'events',
  'topics',
  'schedules',
  'push_subscriptions',
  'users',
  'groups',
]

/**
 * Test helper (not shipped): local, in-memory D1 and R2 from `wrangler.jsonc` via
 * `getPlatformProxy`, with the migrations applied, so DAO tests run real SQL.
 */
export const createTestEnv = async () => {
  const proxy = await getPlatformProxy<Env>({
    configPath: join(packageDir, 'wrangler.jsonc'),
    persist: false,
  })
  const db = proxy.env.DB
  const statements = migrations
    .join('\n')
    .replace(/--.*$/gm, '')
    .split(';')
    .map((sql) => sql.trim())
    .filter(Boolean)
  await db.batch(statements.map((sql) => db.prepare(sql)))

  return {
    db,
    bucket: proxy.env.IMAGES,
    /** Empties every table between tests. */
    reset: async () => {
      await db.batch(tables.map((table) => db.prepare(`DELETE FROM ${table}`)))
    },
    dispose: () => proxy.dispose(),
  }
}
