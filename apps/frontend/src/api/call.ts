import { LIMITS } from 'utils'

/** An API error: `code` is the backend's `{ error: code }`, or `NETWORK` when no response came. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  /** For `LIMIT_EXCEEDED`: the `LIMITS` entry that was exceeded. */
  readonly limit?: string

  constructor(code: string, status: number, limit?: string) {
    super(code)
    this.code = code
    this.status = status
    this.limit = limit
  }
}

interface JsonResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
}

/** A response body without the error shapes (`{ error: code }`) a route can also answer with. */
export type Success<T> = Exclude<T, { error: unknown }>

/** The JSON body of a successful response; throws `ApiError` otherwise (including network errors). */
export const call = async <R extends JsonResponse>(
  request: R | Promise<R>,
): Promise<Success<Awaited<ReturnType<R['json']>>>> => {
  let res: R
  try {
    res = await request
  } catch {
    throw new ApiError('NETWORK', 0)
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string; limit?: string }
    throw new ApiError(body.error ?? 'INTERNAL', res.status, body.limit)
  }
  return (await res.json()) as Success<Awaited<ReturnType<R['json']>>>
}

const limitMessages: Record<string, string> = {
  personalSchedules: `個人の予定は${LIMITS.personalSchedules}件までです`,
  groupSchedules: `グループの予定は${LIMITS.groupSchedules}件までです`,
  eventsPerDayPerSchedule: `1日に登録できるイベントは予定ごとに${LIMITS.eventsPerDayPerSchedule}件までです`,
  topicsPerSchedule: `トピックは予定ごとに${LIMITS.topicsPerSchedule}件までです`,
  imagesPerEvent: `画像はイベントごとに${LIMITS.imagesPerEvent}枚までです`,
  imageMaxBytes: '画像のサイズが大きすぎます',
  imageStorageBytes: '画像の保存容量の上限に達しました',
  groupMembers: `グループのメンバーは${LIMITS.groupMembers}人までです`,
}

const codeMessages: Record<string, string> = {
  UNAUTHORIZED: 'ログインしてください',
  CONSENT_REQUIRED: '利用規約・プライバシーポリシーへの同意が必要です',
  FORBIDDEN: 'この操作はできません',
  NOT_FOUND: '対象が見つかりません（削除された可能性があります）',
  VALIDATION: '入力内容を確認してください',
  LIMIT_EXCEEDED: '上限に達しました',
  DUPLICATE_NAME: '同じ名前がすでにあります',
  ALREADY_IN_GROUP: 'すでに別のグループに参加しています',
  NOT_IN_GROUP: 'グループに参加していません',
  INVITE_INVALID: '招待リンクが無効か、有効期限が切れています',
  NETWORK: '通信できませんでした。接続を確認してください',
}

/** The message to show for an error from `call` (or anything else thrown). */
export const errorMessage = (error: unknown): string => {
  if (!(error instanceof ApiError)) return 'エラーが発生しました'
  if (error.code === 'LIMIT_EXCEEDED' && error.limit && limitMessages[error.limit]) {
    return limitMessages[error.limit]
  }
  return codeMessages[error.code] ?? 'エラーが発生しました。時間をおいてお試しください'
}
