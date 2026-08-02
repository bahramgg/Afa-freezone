/**
 * Whether the client-side route guards redirect.
 *
 * Turned off so every panel can be opened and clicked through without signing
 * in. This changes navigation only — the API still derives the caller from
 * their session and refuses anything they are not entitled to, so an
 * unauthenticated browse renders empty pages rather than other people's data.
 *
 * Flip to `true` to put the redirects back; nothing else has to change.
 */
export const ROUTE_GUARDS_ENABLED = false;
