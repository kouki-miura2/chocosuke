// CSV download (docs/spec.md "設定 > CSVダウンロード"): UTF-8 with BOM, CRLF, every value quoted,
// and a leading `'` on values starting with `= + - @` against CSV injection.

export const CSV_HEADER = [
  '予定',
  '公開範囲',
  'トピック',
  'タイトル',
  '開始日',
  '開始時刻',
  '終了日',
  '終了時刻',
  '終日',
  '通知',
  'メモ',
  '最終更新者',
  '最終更新日時',
] as const

const cell = (value: string): string => {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

/** The file content: BOM, header and rows. */
export const toCsv = (rows: string[][]): string =>
  `\uFEFF${[[...CSV_HEADER], ...rows].map((row) => row.map(cell).join(',')).join('\r\n')}\r\n`

/** `chocosuke_YYYYMMDD.csv` for the download date (`YYYY-MM-DD`). */
export const csvFileName = (date: string): string => `chocosuke_${date.replaceAll('-', '')}.csv`

export interface CsvEvent {
  scheduleName: string
  scope: 'personal' | 'group'
  /** Position of the schedule in the user's order. */
  order: number
  topicName: string
  title: string
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  notify: string
  memo: string | null
  updatedBy: string
  updatedAt: string
}

/** The rows, by start date → start time → schedule order (all-day first within a day). */
export const csvRows = (events: CsvEvent[]): string[][] =>
  [...events]
    .sort(
      (a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
        a.order - b.order,
    )
    .map((e) => [
      e.scheduleName,
      e.scope === 'group' ? 'グループ' : '個人',
      e.topicName,
      e.title,
      e.startDate.replaceAll('-', '/'),
      e.startTime ?? '',
      e.endDate.replaceAll('-', '/'),
      e.endTime ?? '',
      e.startTime === null ? '終日' : '',
      e.notify,
      e.memo ?? '',
      e.updatedBy,
      e.updatedAt,
    ])
