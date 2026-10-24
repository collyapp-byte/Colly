import { prisma } from "@/lib/prisma";

type WeeklyMetrics = {
  businessName: string;
  aiReplies: number;
  manualReplies: number;
  escalations: number;
  salesAmount: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportHtml(metrics: WeeklyMetrics): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f9fafb;font-family:Arial,sans-serif;color:#111827;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <div style="background:#FF6600;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:20px;">Your Colly Weekly Business Report</h1>
        <p style="margin:6px 0 0;color:#fff4ec;font-size:13px;">${escapeHtml(metrics.businessName)}</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 16px;font-size:14px;">Here is how your AI assistant performed over the last 7 days.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">AI replies sent</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;">${metrics.aiReplies}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Manual replies sent</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;">${metrics.manualReplies}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">Escalations</td>
            <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:700;">${metrics.escalations}</td>
          </tr>
          <tr>
            <td style="padding:10px 0;">Total sales</td>
            <td style="padding:10px 0;text-align:right;font-weight:700;">₦${metrics.salesAmount.toLocaleString("en-NG")}</td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">Keep it up. Colly is working for you 24/7.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendReportEmail(
  to: string,
  metrics: WeeklyMetrics,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[weekly-report] RESEND_API_KEY is not set; skipping email");
    return false;
  }

  const from =
    process.env.RESEND_FROM_EMAIL ?? "Colly <reports@colly.com.ng>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: "Your Colly Weekly Business Report",
        html: buildReportHtml(metrics),
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        `[weekly-report] Resend failed (${response.status}): ${detail}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error("[weekly-report] Resend request threw:", error);
    return false;
  }
}

// GET /api/reports/weekly
// Cron-triggered weekly summary for every business with an active plan.
export async function GET(request: Request) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authorization = request.headers.get("authorization");
      if (authorization !== `Bearer ${cronSecret}`) {
        return new Response("Unauthorized", { status: 401 });
      }
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const businesses = await prisma.business.findMany({
      where: { planStatus: "active" },
      select: {
        id: true,
        name: true,
        billingEmail: true,
        users: { select: { email: true }, take: 1 },
      },
    });

    let emailed = 0;

    for (const business of businesses) {
      const [aiReplies, manualReplies, escalations, sales] = await Promise.all([
        prisma.message.count({
          where: {
            businessId: business.id,
            sender: "ai",
            createdAt: { gte: since },
          },
        }),
        prisma.message.count({
          where: {
            businessId: business.id,
            sender: "agent",
            createdAt: { gte: since },
          },
        }),
        prisma.conversation.count({
          where: {
            businessId: business.id,
            escalatedAt: { gte: since },
          },
        }),
        prisma.sale.aggregate({
          where: {
            businessId: business.id,
            status: "paid",
            createdAt: { gte: since },
          },
          _sum: { totalAmount: true },
        }),
      ]);

      const email = business.billingEmail || business.users[0]?.email;
      if (!email) continue;

      const sent = await sendReportEmail(email, {
        businessName: business.name,
        aiReplies,
        manualReplies,
        escalations,
        salesAmount: Number(sales._sum.totalAmount ?? 0),
      });
      if (sent) emailed += 1;
    }

    return Response.json({
      success: true,
      weekStart: since.toISOString(),
      businesses: businesses.length,
      emailed,
    });
  } catch (error) {
    console.error("[GET /api/reports/weekly]", error);
    return Response.json(
      {
        error: "Failed to generate weekly reports",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
