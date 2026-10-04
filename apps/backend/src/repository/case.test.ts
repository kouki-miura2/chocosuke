import { expect, test } from 'vite-plus/test'

import { camelize, snakify } from './case.ts'

test('camelize renames snake_case keys and keeps values', () => {
  expect(camelize({ id: 'a', owner_user_id: 'u', invite_expires_at: 1, deleted_at: null })).toEqual(
    {
      id: 'a',
      ownerUserId: 'u',
      inviteExpiresAt: 1,
      deletedAt: null,
    },
  )
})

test('snakify is the inverse of camelize', () => {
  expect(snakify({ id: 'a', ownerUserId: 'u', deletedAt: null })).toEqual({
    id: 'a',
    owner_user_id: 'u',
    deleted_at: null,
  })
})
