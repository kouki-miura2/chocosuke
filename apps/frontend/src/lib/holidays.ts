import holidays from '@holiday-jp/holiday_jp/lib/holidays'

// Japanese national holidays and substitute holidays, bundled (docs/spec.md "カレンダー > 祝日・休日"):
// no API. Update the package when the law changes them.

const byDate = holidays as Record<string, { name: string } | undefined>

/** The holiday name of a `YYYY-MM-DD` date, or `undefined`. */
export const holidayName = (date: string): string | undefined => byDate[date]?.name
