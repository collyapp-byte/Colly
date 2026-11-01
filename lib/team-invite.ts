/**
 * The team invitation email.
 *
 * A `TeamMember` row only pre-authorises an address — access is granted by
 * matching the signed-in email (`lib/auth.ts#loadTenant`) — so the invitation
 * has to reach the person, not just sit in the owner's settings page. This
 * module builds that email and hands it to `lib/email.ts`.
 *
 * The link points at `/join/<team member id>`, the acceptance page
 * (`app/(auth)/join/[id]/page.tsx`) where the invitee sets a password for the
 * invited address and lands in the workspace as STAFF. The id is the row's
 * cuid: unguessable, and deleting the row (removing the team member) kills the
 * link, so there is no separate token to store or expire.
 *
 * Dependency-free apart from the email sender and `SITE_URL`, so
 * `tests/team-invite.test.ts` can exercise every builder without a database.
 */

import { escapeHtml, sendEmail, type EmailResult } from "@/lib/email";
import { SITE_URL } from "@/lib/site";

/** Where an invite link points. Kept in step with `SESSION_FREE_PATHS`. */
export const TEAM_INVITE_PATH = "/join";

/**
 * The password rule quoted in the email. Must stay equal to
 * `lib/validators.ts#isStrongPassword`, which is what `/join` enforces.
 */
export const TEAM_INVITE_PASSWORD_HINT =
  "Choose a password with at least 8 characters, 1 uppercase, 1 lowercase and 1 number.";

/**
 * Absolute invite URL: `<app>/join/<id>`.
 *
 * `baseUrl` defaults to `SITE_URL`, which honours `NEXT_PUBLIC_APP_URL` and
 * falls back to the production origin, so the invite API never throws just
 * because the variable is missing.
 */
export function teamInviteLink(
  memberId: string,
  baseUrl: string = SITE_URL,
): string {
  const id = memberId.trim();
  if (!id) {
    throw new Error("A team member id is required to build an invite link");
  }

  const base = (baseUrl.trim().replace(/\/+$/, "") || SITE_URL).replace(
    /\/+$/,
    "",
  );

  return `${base}${TEAM_INVITE_PATH}/${encodeURIComponent(id)}`;
}

/** Subject line. Names the workspace so it is not mistaken for spam. */
export function teamInviteSubject(businessName: string): string {
  const name = businessName.trim() || "a workspace";
  return `You're invited to join ${name} on Colly`;
}

export type TeamInviteEmailInput = {
  businessName: string;
  /** The owner's name; the copy falls back to "The business owner". */
  inviterName?: string | null;
  /** The invitee's name (`TeamMember.name`); only used for the greeting. */
  inviteeName?: string | null;
  /** The invited address — the one they must sign in with. */
  email: string;
  /** Absolute accept URL from `teamInviteLink()`. */
  link: string;
};

export type TeamInviteEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * Builds the invitation as HTML plus a plain-text alternative.
 *
 * Every interpolated value is escaped: a business name is owner-supplied free
 * text, and an unescaped `<` would break the markup.
 */
export function buildTeamInviteEmail(
  input: TeamInviteEmailInput,
): TeamInviteEmail {
  const businessName = input.businessName.trim() || "a business on Colly";
  const inviter = input.inviterName?.trim() || "The business owner";
  const invitee = input.inviteeName?.trim() || "";
  const greeting = invitee ? `Hi ${invitee.split(/\s+/)[0]},` : "Hello,";
  const email = input.email.trim();
  const link = input.link.trim();

  const text = [
    greeting,
    "",
    `${inviter} invited you to join ${businessName} on Colly as a staff member.`,
    "",
    "Accept the invite here:",
    link,
    "",
    `Sign in with this email address, otherwise Colly cannot match you to the team: ${email}`,
    "",
    TEAM_INVITE_PASSWORD_HINT,
    "",
    "If you were not expecting this invitation you can ignore this email - nothing happens until you accept it.",
    "",
    "Colly - AI customer service for small businesses",
  ].join("\n");

  return {
    subject: teamInviteSubject(businessName),
    html: buildInviteHtml({ businessName, inviter, greeting, email, link }),
    text,
  };
}


type InviteHtmlInput = {
  businessName: string;
  inviter: string;
  greeting: string;
  email: string;
  link: string;
};

/**
 * The HTML body. Same header colour and card layout as the weekly report
 * (`app/api/reports/weekly/route.ts`), so Colly mail looks like one brand.
 * Inline styles only: email clients strip `<style>` blocks.
 */
function buildInviteHtml({
  businessName,
  inviter,
  greeting,
  email,
  link,
}: InviteHtmlInput): string {
  const href = escapeHtml(link);
  const safeBusiness = escapeHtml(businessName);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#FF6600;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">You're invited to Colly</h1>
        <p style="margin:6px 0 0;color:#fff4ec;font-size:13px;">${safeBusiness}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 12px;font-size:14px;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6;">
          ${escapeHtml(inviter)} invited you to join
          <strong>${safeBusiness}</strong> on Colly as a staff member. You will
          work inside their dashboard with their products, customers and inbox.
        </p>
        <p style="margin:0 0 24px;">
          <a href="${href}" style="display:inline-block;background:#FF6600;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 20px;border-radius:8px;">Join the team</a>
        </p>
        <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">
          If the button does not work, paste this link into your browser:
        </p>
        <p style="margin:0 0 20px;font-size:13px;word-break:break-all;">
          <a href="${href}" style="color:#FF6600;">${href}</a>
        </p>
        <div style="border-top:1px solid #f3f4f6;padding-top:16px;font-size:13px;color:#374151;line-height:1.6;">
          <p style="margin:0 0 8px;">
            Use this email address when you sign in:
            <strong>${escapeHtml(email)}</strong>
          </p>
          <p style="margin:0;">${escapeHtml(TEAM_INVITE_PASSWORD_HINT)}</p>
        </div>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
          If you were not expecting this invitation you can ignore this email -
          nothing happens until you accept it.
        </p>
      </div>
    </div>
  </body>
</html>`;
}

/**
 * Sends the invitation. Returns `{ sent: false, error }` instead of throwing:
 * the invite row is the source of truth and the owner can still share the link
 * by hand, so a mail failure must never fail the invite.
 */
export async function sendTeamInviteEmail(
  input: TeamInviteEmailInput,
): Promise<EmailResult> {
  const message = buildTeamInviteEmail(input);

  return sendEmail({
    to: input.email,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
}
