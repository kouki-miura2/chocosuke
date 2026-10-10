/**
 * Error codes the API returns as `{ error: code }`. The
 * frontend picks the message by code. Services throw `AppError`; only `app.ts` maps a code to an
 * HTTP status.
 */
export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  CONSENT_REQUIRED: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 400,
  LIMIT_EXCEEDED: 409,
  DUPLICATE_NAME: 409,
  ALREADY_IN_GROUP: 409,
  NOT_IN_GROUP: 409,
  INVITE_INVALID: 410,
} as const

export type ErrorCode = keyof typeof ERROR_STATUS

export class AppError extends Error {
  readonly code: ErrorCode
  /** For `LIMIT_EXCEEDED`: the `LIMITS` entry that was exceeded. */
  readonly limit?: string

  constructor(code: ErrorCode, options: { limit?: string; message?: string } = {}) {
    super(options.message ?? code)
    this.code = code
    this.limit = options.limit
  }
}
