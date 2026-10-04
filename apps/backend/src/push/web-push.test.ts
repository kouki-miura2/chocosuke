import { expect, test } from 'vite-plus/test'

import {
  concat,
  encryptPayload,
  fromBase64Url,
  toBase64Url,
  vapidAuthorization,
} from './web-push.ts'

const encoder = new TextEncoder()

const hkdf = async (
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: string | Uint8Array<ArrayBuffer>,
  bytes: number,
) => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const infoBytes = typeof info === 'string' ? encoder.encode(info) : info
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes },
      key,
      bytes * 8,
    ),
  )
}

/** The browser side of RFC 8291: decrypts an aes128gcm body with the subscription's private key. */
const decrypt = async (
  body: Uint8Array<ArrayBuffer>,
  ua: CryptoKeyPair,
  authSecret: Uint8Array<ArrayBuffer>,
) => {
  const salt = body.slice(0, 16)
  const idLength = body[20]
  const asPublic = body.slice(21, 21 + idLength)
  const ciphertext = body.slice(21 + idLength)
  const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey))
  const asKey = await crypto.subtle.importKey(
    'raw',
    asPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256),
  )
  const ikm = await hkdf(
    authSecret,
    ecdhSecret,
    concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic),
    32,
  )
  const cek = await hkdf(salt, ikm, 'Content-Encoding: aes128gcm\0', 16)
  const nonce = await hkdf(salt, ikm, 'Content-Encoding: nonce\0', 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext),
  )
  expect(plaintext.at(-1)).toBe(2)
  return new TextDecoder().decode(plaintext.slice(0, -1))
}

test('encryptPayload produces an aes128gcm body the subscribed browser can decrypt', async () => {
  const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const authSecret = crypto.getRandomValues(new Uint8Array(16))
  const p256dh = toBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey)))

  const body = await encryptPayload('{"title":"打合せ"}', { p256dh, auth: toBase64Url(authSecret) })

  expect(new DataView(body.buffer).getUint32(16)).toBe(4096)
  expect(await decrypt(body, ua, authSecret)).toBe('{"title":"打合せ"}')
})

test('vapidAuthorization signs a JWT for the push service origin with the VAPID key', async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
  const publicKey = toBase64Url(
    new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)),
  )

  const header = await vapidAuthorization(
    'https://push.example.com/send/abc',
    { publicKey, privateKey: jwk.d ?? '', subject: 'mailto:admin@example.com' },
    Date.parse('2026-10-04T00:00:00Z'),
  )

  const [, token, key] = /^vapid t=([^,]+), k=(.+)$/.exec(header) ?? []
  expect(key).toBe(publicKey)
  const [head, payload, signature] = token.split('.')
  expect(JSON.parse(new TextDecoder().decode(fromBase64Url(payload)))).toEqual({
    aud: 'https://push.example.com',
    exp: Date.parse('2026-10-04T12:00:00Z') / 1000,
    sub: 'mailto:admin@example.com',
  })
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    pair.publicKey,
    fromBase64Url(signature),
    encoder.encode(`${head}.${payload}`),
  )
  expect(valid).toBe(true)
})
