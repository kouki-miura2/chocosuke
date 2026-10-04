/**
 * Whether `value` is an absolute `http:` / `https:` URL. An event's URL is shown as a link, so any
 * other scheme (`javascript:`, `data:`, ...) is refused. Shared by the event form and the API.
 */
export const isHttpUrl = (value: string): boolean => {
  if (!URL.canParse(value)) return false
  const { protocol, hostname } = new URL(value)
  return (protocol === 'http:' || protocol === 'https:') && hostname !== ''
}
