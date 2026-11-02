import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { message, product } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let response = "";

    if (message.toLowerCase().includes("price") || message.toLowerCase().includes("cost") || message.toLowerCase().includes("how much")) {
      response = `The ${product?.name || "product"} costs ₦${product?.price?.toLocaleString() || "0"}. Would you like to place an order?`;
    } else if (message.toLowerCase().includes("hello") || message.toLowerCase().includes("hi") || message.toLowerCase().includes("hey")) {
      response = `Hello! I can tell you about our ${product?.name || "products"}. What would you like to know?`;
    } else if (message.toLowerCase().includes("order") || message.toLowerCase().includes("buy")) {
      response = `Great! To order the ${product?.name || "product"} (₦${product?.price?.toLocaleString() || "0"}), please share your name and delivery address.`;
    } else {
      response = `Thanks for asking! Our ${product?.name || "product"} is ₦${product?.price?.toLocaleString() || "0"}. How can I help you further?`;
    }

    return NextResponse.json({ response });
  } catch (error) {
    console.error("[onboarding/test-chat] error:", error);
    return NextResponse.json({ error: "Failed to get AI response" }, { status: 500 });
  }
}
