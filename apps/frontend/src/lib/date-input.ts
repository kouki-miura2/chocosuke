// Vuetify's date picker works with `Date`s at local midnight, so these two read and write the
// device's local calendar date. Everywhere else dates are `YYYY-MM-DD` strings in the app's zone.

const pad = (value: number) => String(value).padStart(2, '0')

/** `YYYY-MM-DD` → the `Date` the picker shows as that day. */
export const toPickerDate = (date: string): Date =>
  new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)))

/** The day the picker selected → `YYYY-MM-DD`. */
export const fromPickerDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
