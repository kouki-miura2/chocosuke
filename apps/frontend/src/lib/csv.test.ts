import { expect, test } from 'vite-plus/test'

import { csvFileName, csvRows, toCsv } from './csv.ts'

test('quotes every value, escapes quotes, and guards against formulas', () => {
  const csv = toCsv([
    ['仕事', '個人', '', '=SUM(A1)', '2026-10-05', '', '', '', '', '', 'a"b\nc', '-', '@x'],
  ])

  expect(csv.startsWith('\uFEFF"予定","公開範囲"')).toBe(true)
  expect(csv).toContain('"\'=SUM(A1)"')
  expect(csv).toContain('"a""b\nc"')
  expect(csv).toContain('"\'-","\'@x"\r\n')
})

test('names the file by date', () => {
  expect(csvFileName('2026-10-04')).toBe('chocosuke_20261004.csv')
})

test('sorts rows by date, time and schedule order', () => {
  const base = {
    scheduleName: '仕事',
    scope: 'personal' as const,
    topicName: '',
    title: 't',
    endDate: '2026-10-05',
    endTime: null,
    notify: 'なし',
    memo: null,
    updatedBy: '',
    updatedAt: '',
  }
  const rows = csvRows([
    {
      ...base,
      title: 'late',
      order: 0,
      startDate: '2026-10-05',
      startTime: '15:00',
      endTime: '16:00',
    },
    { ...base, title: 'second', order: 1, startDate: '2026-10-05', startTime: null },
    { ...base, title: 'first', order: 0, startDate: '2026-10-05', startTime: null },
    {
      ...base,
      title: 'earlier',
      order: 5,
      startDate: '2026-10-04',
      startTime: '09:00',
      endTime: '10:00',
    },
  ])

  expect(rows.map((row) => row[3])).toEqual(['earlier', 'first', 'second', 'late'])
  expect(rows[1].slice(4, 9)).toEqual(['2026/10/05', '', '2026/10/05', '', '終日'])
})
