/**
 * Whether the client-side route guards send an unrecognised visitor to sign in.
 *
 * On, now that there is a sign-in to send them to: one email door serves all
 * four panels. Turning it off leaves navigation open, which is only useful
 * alongside AUTH_OPEN_ACCESS — on its own it just renders empty pages, because
 * the API still asks who is calling.
 */
export const ROUTE_GUARDS_ENABLED = true;
