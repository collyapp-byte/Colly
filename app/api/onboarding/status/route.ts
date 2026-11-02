import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const business = await prisma.business.findUnique({
      where: { id: user.businessId },
      select: {
        id: true,
        telegramBotToken: true,
        onboardingCompleted: true,
        products: { take: 1, select: { id: true, name: true, price: true } },
      },
    });

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const product = business.products[0] || null;
    const telegramConnected = !!business.telegramBotToken;

    return NextResponse.json({
      completed: business.onboardingCompleted,
      product: product ? { name: product.name, price: Number(product.price) } : null,
      telegramConnected,
    });
  } catch (error) {
    console.error("[onboarding/status] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
