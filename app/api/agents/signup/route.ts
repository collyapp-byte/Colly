import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fullName, email, phone, state: region, password, isOAuth } = body;

    if (!fullName || !email) {
      return NextResponse.json({ ok: false, error: "Name and email are required." }, { status: 400 });
    }

    const existing = await prisma.agent.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "That email is already registered." }, { status: 400 });
    }

    let supabaseUserId: string | null = null;
    let needsConfirmation = false;

    if (isOAuth) {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        return NextResponse.json({ ok: false, error: "Not authenticated with Google." }, { status: 401 });
      }
      supabaseUserId = user.id;
    } else {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        if (error.message.includes("already registered")) {
          return NextResponse.json({ ok: false, error: "That email is already registered." }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
      }
      if (!data.user) {
        return NextResponse.json({ ok: false, error: "Could not create account." }, { status: 500 });
      }
      supabaseUserId = data.user.id;
      needsConfirmation = !data.session;
    }

    const agentNumber = `AG-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    await prisma.agent.create({
      data: {
        agentNumber,
        email,
        fullName,
        phone: phone || null,
        state: region || null,
        supabaseUserId,
      },
    });

    return NextResponse.json({ ok: true, needsConfirmation });
  } catch (error) {
    console.error("[AGENT_SIGNUP]", error);
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 });
  }
}