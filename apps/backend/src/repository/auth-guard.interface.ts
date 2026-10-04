export interface AuthenticatedUser {
  id: string
  /** The terms version the user had agreed to when the session was issued. */
  termsVersion: string
}

export interface AuthGuard {
  /** Resolves the authenticated user from a request, or `null` if unauthenticated. */
  authenticate: (request: Request) => Promise<AuthenticatedUser | null>
}
