// Web Push with WebCrypto only, so it runs on Cloudflare Workers (the `web-push` npm package needs
// Node's crypto): payload encryption per RFC 8291 (aes128gcm, RFC 8188) and VAPID per RFC 8292.

export interface PushTarget {
  endpoint: string
  /** The browser's P-256 public key (65-byte uncompressed point), base64url. */
  p256dh: string
  /** The browser's 16-byte auth secret, base64url. */
  auth: string
}

/** `gone`: the subscription no longer exists (404/410) and should be deleted. */
export type PushResult = 'sent' | 'gone' | 'failed'

export interface PushSender {
  send: (target: PushTarget, payload: string) => Promise<PushResult>
}

export interface VapidKeys {
  /** 65-byte uncompressed P-256 public key, base64url (what the browser subscribes with). */
  publicKey: string
  /** 32-byte P-256 private scalar, base64url. */
  privateKey: string
  /** Contact for the push service, `mailto:` or `https:` URL. */
  subject: string
}

const encoder = new TextEncoder()

/** UTF-8 bytes on a plain `ArrayBuffer` (Workers' and the DOM's WebCrypto typings both accept it). */
const utf8 = (value: string): Uint8Array<ArrayBuffer> => new Uint8Array(encoder.encode(value))

/** The raw form of a public key. */
const exportRaw = async (key: CryptoKey): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array((await crypto.subtle.exportKey('raw', key)) as ArrayBuffer)

/** ECDH shared secret (32 bytes) between a private key and a peer's public key. */
const ecdhSecret = async (
  privateKey: CryptoKey,
  publicKey: CryptoKey,
): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(
    await crypto.subtle.deriveBits(
      // Workers' typings name the field `$public`, but the runtime (like browsers) reads `public`.
      { name: 'ECDH', public: publicKey } as unknown as Parameters<
        typeof crypto.subtle.deriveBits
      >[0],
      privateKey,
      256,
    ),
  )

export const toBase64Url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

export const fromBase64Url = (value: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))

export const concat = (...parts: Uint8Array[]): Uint8Array<ArrayBuffer> => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

const hkdf = async (
  salt: Uint8Array<ArrayBuffer>,
  ikm: Uint8Array<ArrayBuffer>,
  info: Uint8Array<ArrayBuffer>,
  bytes: number,
): Promise<Uint8Array<ArrayBuffer>> => {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8),
  )
}

/** Record size written in the aes128gcm header; one record is enough for a short payload. */
const recordSize = 4096

/** Encrypts `payload` for one subscription: the aes128gcm body (RFC 8188 header + one record). */
export const encryptPayload = async (
  payload: string,
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
): Promise<Uint8Array<ArrayBuffer>> => {
  const uaPublic = fromBase64Url(target.p256dh)
  const authSecret = fromBase64Url(target.auth)

  const ephemeral = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const asPublic = await exportRaw(ephemeral.publicKey)
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const shared = await ecdhSecret(ephemeral.privateKey, uaKey)

  // RFC 8291 section 3.4: input keying material from the ECDH secret and the auth secret.
  const ikm = await hkdf(
    authSecret,
    shared,
    concat(utf8('WebPush: info\0'), uaPublic, asPublic),
    32,
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(salt, ikm, utf8('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, utf8('Content-Encoding: nonce\0'), 12)

  // A single, final record: the content followed by the 0x02 padding delimiter.
  const plaintext = concat(utf8(payload), new Uint8Array([2]))
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, plaintext),
  )

  const header = new Uint8Array(16 + 4 + 1)
  header.set(salt)
  new DataView(header.buffer).setUint32(16, recordSize)
  header[20] = asPublic.length
  return concat(header, asPublic, ciphertext)
}

/** The `Authorization` header value for a push service at `endpoint` (RFC 8292). */
export const vapidAuthorization = async (
  endpoint: string,
  keys: VapidKeys,
  now: number,
): Promise<string> => {
  const publicKey = fromBase64Url(keys.publicKey)
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: keys.privateKey,
      x: toBase64Url(publicKey.slice(1, 33)),
      y: toBase64Url(publicKey.slice(33, 65)),
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const segment = (value: object) => toBase64Url(utf8(JSON.stringify(value)))
  const unsigned = `${segment({ typ: 'JWT', alg: 'ES256' })}.${segment({
    aud: new URL(endpoint).origin,
    exp: Math.floor(now / 1000) + 12 * 60 * 60,
    sub: keys.subject,
  })}`
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, utf8(unsigned)),
  )
  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${keys.publicKey}`
}

export const createWebPushSender = (keys: VapidKeys, now: () => number): PushSender => ({
  send: async (target, payload) => {
    try {
      const response = await fetch(target.endpoint, {
        method: 'POST',
        headers: {
          Authorization: await vapidAuthorization(target.endpoint, keys, now()),
          'Content-Encoding': 'aes128gcm',
          'Content-Type': 'application/octet-stream',
          // Undelivered notifications are useless after the event has likely started.
          TTL: '3600',
          Urgency: 'high',
        },
        body: await encryptPayload(payload, target),
      })
      if (response.status === 404 || response.status === 410) return 'gone'
      return response.ok ? 'sent' : 'failed'
    } catch {
      return 'failed'
    }
  },
})
