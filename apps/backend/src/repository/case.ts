// snake_case storage columns <-> camelCase domain fields, so repositories don't hand-map every column.

type CamelCase<S extends string> = S extends `${infer Head}_${infer Tail}`
  ? `${Head}${Capitalize<CamelCase<Tail>>}`
  : S

/** `T` with its snake_case keys renamed to camelCase. */
export type Camelize<T> = { [K in keyof T as CamelCase<K & string>]: T[K] }

export const camelize = <T extends object>(row: T): Camelize<T> =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()),
      value,
    ]),
  ) as Camelize<T>

export const snakify = (fields: object): Record<string, string | number | null> =>
  Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
      value,
    ]),
  )
