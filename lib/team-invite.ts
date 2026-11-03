import { SITE_URL } from "@/lib/site";

export function teamInviteLink(id: string): string {
  return `${SITE_URL}/join/${id}`;
}

type InviteEmailParams = {
  businessName: string;
  inviterName: string;
  inviteeName: string;
  email: string;
  link: string;
};

export async function sendTeamInviteEmail({
  businessName,
  inviterName,
  inviteeName,
  email,
  link,
}: InviteEmailParams): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  // Fallback to a generic email if not set
  const fromEmail = process.env.BREVO_FROM_EMAIL || "team@colly.com.ng";

  if (!apiKey) {
    return { sent: false, error: "BREVO_API_KEY is not configured in .env" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: "Colly",
          email: fromEmail,
        },
        to: [{ email, name: inviteeName }],
        subject: `Join ${businessName} on Colly`,
        htmlContent: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You've been invited!</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> on Colly.</p>
            <p>Click the button below to accept the invitation and set up your account:</p>
            <a href="${link}" style="display: inline-block; padding: 12px 24px; background-color: #FF6600; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 16px 0;">Join Workspace</a>
            <p style="color: #666; font-size: 14px;">Or copy and paste this link into your browser:</p>
            <p style="color: #666; font-size: 14px;"><a href="${link}">${link}</a></p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("[BREVO ERROR]", errorData);
      return { 
        sent: false, 
        error: errorData?.message || "Failed to send email via Brevo" 
      };
    }

    return { sent: true };
  } catch (error) {
    console.error("[BREVO ERROR]", error);
    return { 
      sent: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    };
  }
}