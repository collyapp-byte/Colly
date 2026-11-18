export type SendTeamInviteParams = {
  businessName: string;
  inviterName: string;
  inviteeName: string;
  email: string;
  link: string;
};

export function teamInviteLink(memberId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://colly.com.ng";
  return `${baseUrl.replace(/\/$/, "")}/join/${memberId}`;
}

export async function sendTeamInviteEmail({
  businessName,
  inviterName,
  inviteeName,
  email,
  link,
}: SendTeamInviteParams): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "Colly <reports@colly.com.ng>";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: from,
        to: [{ email, name: inviteeName }],
        subject: `Join ${businessName} on Colly`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2>Hi ${inviteeName},</h2>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${businessName}</strong> on Colly.</p>
            <p style="margin: 24px 0;">
              <a href="${link}" style="background-color: #f97316; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Accept Invitation</a>
            </p>
            <p style="font-size: 14px; color: #555;">Or copy and paste this link: <a href="${link}">${link}</a></p>
          </div>
        `,
        text: `Hi ${inviteeName}, ${inviterName} invited you to join ${businessName} on Colly. Accept here: ${link}`,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[Resend] Email sending failed:", response.status, errText);
      return { sent: false, error: `Resend error ${response.status}` };
    }

    return { sent: true };
  } catch (error) {
    console.error("[Resend] Network/fetch error:", error);
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Failed to send email",
    };
  }
}