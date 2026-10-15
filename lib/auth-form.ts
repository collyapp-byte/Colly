/**
 * Shared shape for the login and signup forms.
 *
 * This lives outside `lib/auth-actions.ts` because a `"use server"` module may
 * only export async functions, and the initial state has to be a plain value
 * the client can hand to `useActionState`.
 */
export type AuthFormState = {
  /** Shown in the red error block. */
  error: string | null;
  /** Shown in the green notice block (e.g. "confirm your email"). */
  notice: string | null;
};

export const INITIAL_AUTH_STATE: AuthFormState = { error: null, notice: null };
