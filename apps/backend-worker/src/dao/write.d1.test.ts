import type { Owner } from 'backend/src/dao/write.interface.ts'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vite-plus/test'

import { createTestEnv } from './test-env.ts'
import { createWriteDao } from './write.d1.ts'

let env: Awaited<ReturnType<typeof createTestEnv>>
beforeAll(async () => {
  env = await createTestEnv()
})
afterAll(() => env.dispose())
beforeEach(() => env.reset())

const user: Owner = { scope: 'personal', id: 'u1' }

const insertUser = (id: string, fields: Record<string, unknown> = {}) =>
  createWriteDao(env.db).commit(
    [],
    [
      {
        kind: 'insert',
        table: 'users',
        values: { id, google_sub: `sub-${id}`, created_at: 0, ...fields },
      },
    ],
  )

const schedule = (id: string, name: string) => ({
  kind: 'insert' as const,
  table: 'schedules' as const,
  values: {
    id,
    scope: 'personal',
    owner_id: 'u1',
    name,
    color: 'blue',
    created_at: 0,
    updated_at: 0,
  },
  revOf: user,
})

test('commit bumps the owner revision and stamps the rows with it', async () => {
  await insertUser('u1')
  const dao = createWriteDao(env.db)

  await dao.commit([user], [schedule('s1', '仕事')])
  await dao.commit([user, user], [schedule('s2', '勉強会')])

  const { rev } = (await env.db
    .prepare('SELECT rev FROM users WHERE id = ?')
    .bind('u1')
    .first<{ rev: number }>())!
  const rows = (await env.db.prepare('SELECT id, rev FROM schedules ORDER BY id').all()).results
  expect(rev).toBe(2)
  expect(rows).toEqual([
    { id: 's1', rev: 1 },
    { id: 's2', rev: 2 },
  ])
})

test('commit is atomic: a failing statement rolls back the bump and earlier rows', async () => {
  await insertUser('u1')
  const dao = createWriteDao(env.db)
  await dao.commit([user], [schedule('s1', '仕事')])

  // Same name as a live schedule of the owner violates the unique index.
  await expect(
    dao.commit([user], [schedule('s2', '勉強会'), schedule('s3', '仕事')]),
  ).rejects.toThrow()

  const { rev } = (await env.db
    .prepare('SELECT rev FROM users WHERE id = ?')
    .bind('u1')
    .first<{ rev: number }>())!
  const count = await env.db.prepare('SELECT COUNT(*) AS n FROM schedules').first<{ n: number }>()
  expect(rev).toBe(1)
  expect(count?.n).toBe(1)
})

test('update matches null as IS NULL and reports changed rows', async () => {
  await insertUser('u1')
  const dao = createWriteDao(env.db)
  await dao.commit([user], [schedule('s1', '仕事'), schedule('s2', '勉強会')])
  await dao.commit(
    [],
    [{ kind: 'update', table: 'schedules', where: { id: 's2' }, set: { deleted_at: 5 } }],
  )

  const [changed] = await dao.commit(
    [user],
    [
      {
        kind: 'update',
        table: 'schedules',
        where: { owner_id: 'u1', deleted_at: null },
        set: { color: 'red' },
        revOf: user,
      },
    ],
  )

  expect(changed).toBe(1)
  const rows = (await env.db.prepare('SELECT id, color, rev FROM schedules ORDER BY id').all())
    .results
  expect(rows).toEqual([
    { id: 's1', color: 'red', rev: 2 },
    { id: 's2', color: 'blue', rev: 1 },
  ])
})

test('joinGroup refuses once the group is full', async () => {
  for (const id of ['a', 'b', 'c']) await insertUser(id)
  const dao = createWriteDao(env.db)
  const join = (userId: string) =>
    dao.commit(
      [],
      [
        {
          kind: 'joinGroup',
          userId,
          groupId: 'g1',
          memberName: userId,
          joinedAt: 1,
          maxMembers: 2,
        },
      ],
    )

  expect(await join('a')).toEqual([1])
  expect(await join('b')).toEqual([1])
  expect(await join('c')).toEqual([0])
})

test('rejects identifiers that are not plain column names', async () => {
  await expect(
    createWriteDao(env.db).commit(
      [],
      [{ kind: 'update', table: 'users', where: { 'id = id OR 1': 1 }, set: { member_name: 'x' } }],
    ),
  ).rejects.toThrow('invalid SQL identifier')
})
