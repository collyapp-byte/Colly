import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { handleIncomingMessage } from "@/lib/chat-engine";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const customerPhone = "onboarding:" + user.businessId;

    await prisma.customer.upsert({
      where: {
        businessId_phone: {
          businessId: user.businessId,
          phone: customerPhone,
        },
      },
      create: {
        businessId: user.businessId,
        phone: customerPhone,
        name: "Test Customer (Onboarding)",
        tags: ["onboarding-test"],
      },
      update: {},
    });

    const response = await handleIncomingMessage({
      businessId: user.businessId,
      customerPhone,
      message,
    });

    return NextResponse.json({ reply: response.reply });
  } catch (error) {
    console.error("[ONBOARDING_TEST_CHAT]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}