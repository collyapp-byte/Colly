export const instant = false;
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const botToken = `onboarding_${Date.now()}_${user.businessId}`;

    await prisma.business.update({
      where: { id: user.businessId },
      data: { telegramBotToken: botToken },
    });

    return NextResponse.json({ success: true, message: "Telegram connected (simulated)" });
  } catch (error) {
    console.error("[onboarding/telegram] error:", error);
    return NextResponse.json({ error: "Failed to connect Telegram" }, { status: 500 });
  }
}
