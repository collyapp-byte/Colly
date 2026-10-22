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
  /**
   * Set when the account was created but the address still has to be confirmed:
   * Supabase sent a verification link and returned no session. The form then
   * shows the "check your email" screen instead of the dashboard.
   */
  requiresEmailVerification?: boolean;
  /** The address the verification link was sent to. */
  email?: string | null;
};

export const INITIAL_AUTH_STATE: AuthFormState = { error: null, notice: null };

/**
 * The message shown after a signup that needs the address confirmed. The email
 * is interpolated so the user can see which inbox to check.
 */
export function emailVerificationMessage(email: string): string {
  return `Check your email! We sent a verification link to ${email}. You must verify your email before logging in.`;
}
