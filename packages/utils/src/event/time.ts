/**
 * Minutes between the start/end times an event can take (`docs/spec.md` "イベント > 項目"). Shared by
 * the event form (its time choices) and the API (which rejects any other time).
 */
export const EVENT_TIME_STEP_MINUTES = 10

/** Whether `time` (`HH:mm`) falls on the event time step. */
export const isOnTimeStep = (time: string): boolean =>
  (Number(time.slice(0, 2)) * 60 + Number(time.slice(3))) % EVENT_TIME_STEP_MINUTES === 0
