import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isMissingConfigError } from "@/lib/supabase/env";
import { generateAgentNumber } from "@/lib/agent-id";
import { isValidEmail, isStrongPassword, WEAK_PASSWORD_ERROR } from "@/lib/validators";

/**
 * Agent signup.
 *
 * Creates the Supabase Auth user, then the matching Agent row, linked on
 * `supabaseUserId`. Agent numbers are generated sequentially ("AG-0001") and the
 * insert is retried on a collision, since two signups can race.
 *
 * When Supabase has "Confirm email" enabled there is no session yet; the
 * response sets `needsConfirmation` so the page can ask the agent to confirm
 * before signing in.
 */

type SignupBody = {
  fullName?: unknown;
  email?: unknown;
  phone?: unknown;
  state?: unknown;
  password?: unknown;
};

function badRequest(error: string, status = 400) {
  return Response.json({ error }, { status });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function POST(request: Request) {
  let body: SignupBody;
  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return badRequest("Invalid request body.");
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const state = typeof body.state === "string" ? body.state.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!fullName || !email || !password) {
    return badRequest("Please fill in every required field.");
  }
  if (!isValidEmail(email)) {
    return badRequest("Enter a valid email address.");
  }
  if (!isStrongPassword(password)) {
    return badRequest(WEAK_PASSWORD_ERROR);
  }

  try {
    const existing = await prisma.agent.findUnique({ where: { email } });

    if (existing?.supabaseUserId) {
      return badRequest("That email is already registered. Sign in instead.");
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, kind: "agent" } },
    });

    if (error) {
      console.error("[agent-signup] supabase:", error.message);
      return badRequest(error.message);
    }

    if (!data.user) {
      return badRequest("Could not create your account. Please try again.", 500);
    }

    const authUser = data.user;

    // Supabase returns a placeholder user with no identities when the email is
    // already registered, so the API can't be used to discover which emails
    // exist. Bail out before creating an agent for a stranger's account.
    if (authUser.identities && authUser.identities.length === 0) {
      return badRequest("That email is already registered. Sign in instead.");
    }

    let agentNumber: string;

    if (existing) {
      // Adopt the pre-created agent row: link it to this new auth user.
      const adopted = await prisma.agent.update({
        where: { id: existing.id },
        data: {
          supabaseUserId: authUser.id,
          fullName,
          phone: phone || null,
          state: state || null,
        },
      });
      agentNumber = adopted.agentNumber;
    } else {
      agentNumber = await createAgentWithRetry({
        email,
        fullName,
        phone: phone || null,
        state: state || null,
        supabaseUserId: authUser.id,
      });
    }

    return Response.json({
      ok: true,
      agentNumber,
      needsConfirmation: !data.session,
    });
  } catch (error) {
    if (isMissingConfigError(error)) {
      return badRequest(error.message, 500);
    }
    if (isUniqueViolation(error)) {
      return badRequest("That email is already registered. Sign in instead.");
    }

    console.error("[agent-signup]", error);
    return badRequest("Could not create your account. Please try again.", 500);
  }
}

/** Creates the Agent row, regenerating the number on a unique collision. */
async function createAgentWithRetry(data: {
  email: string;
  fullName: string;
  phone: string | null;
  state: string | null;
  supabaseUserId: string;
}): Promise<string> {
  const MAX_ATTEMPTS = 5;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const agentNumber = await generateAgentNumber();

    try {
      const agent = await prisma.agent.create({
        data: { ...data, agentNumber },
      });
      return agent.agentNumber;
    } catch (error) {
      if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS - 1) {
        // Another signup took this number between the scan and the insert.
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate an agent number.");
}
