/** The `redirect` query of the login/consent screens, if it's a path inside the app; else `/`. */
export const redirectTarget = (query: Record<string, unknown>): string => {
  const target = query.redirect
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : '/'
}
