import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { whatsapp, email } = await req.json();

    if (!whatsapp) {
      return NextResponse.json({ error: "WhatsApp number is required" }, { status: 400 });
    }

    // TODO (B6): Save to Supabase via Prisma
    console.log("[WAITLIST SIGNUP]", { whatsapp, email, date: new Date().toISOString() });

    await new Promise((resolve) => setTimeout(resolve, 800));

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
