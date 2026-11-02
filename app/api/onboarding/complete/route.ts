import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.business.update({
      where: { id: user.businessId },
      data: { onboardingCompleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[onboarding/complete] error:", error);
    return NextResponse.json({ error: "Failed to complete onboarding" }, { status: 500 });
  }
}
