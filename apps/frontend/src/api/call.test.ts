import { expect, test } from 'vite-plus/test'

import { ApiError, call, errorMessage } from './call.ts'

test('returns the JSON body of a successful response', async () => {
  await expect(call(Promise.resolve(Response.json({ id: 'a' })))).resolves.toEqual({ id: 'a' })
})

test("throws the backend's error code and exceeded limit", async () => {
  const res = Response.json(
    { error: 'LIMIT_EXCEEDED', limit: 'personalSchedules' },
    { status: 409 },
  )

  const error = await call(res).catch((e: unknown) => e)

  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ code: 'LIMIT_EXCEEDED', status: 409, limit: 'personalSchedules' })
  expect(errorMessage(error)).toBe('個人の予定は10件までです')
})

test('turns a failed request into a NETWORK error', async () => {
  const error = await call(Promise.reject(new TypeError('Failed to fetch'))).catch(
    (e: unknown) => e,
  )

  expect(error).toMatchObject({ code: 'NETWORK' })
  expect(errorMessage(error)).toContain('通信できませんでした')
})
