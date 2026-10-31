import { getCurrentBusinessId } from "@/lib/auth";
import { getAppUrl } from "@/lib/app-url";
import { initializeTransaction } from "@/lib/paystack";
import { isValidEmail } from "@/lib/validators";

/**
 * Bounds for an in-chat payment link, in Naira. Paystack's smallest accepted
 * charge is ₦1 (100 kobo); the ceiling is a typo guard rather than a business
 * rule -- an owner who types one zero too many gets a 400 instead of a charge
 * nobody can pay.
 */
const MIN_AMOUNT_NAIRA = 1;
const MAX_AMOUNT_NAIRA = 10_000_000;

type CreateLinkBody = {
  amount?: unknown;
  businessId?: unknown;
  customerEmail?: unknown;
};

function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

/**
 * Naira to kobo, or null when the value cannot be charged. Paystack takes an
 * integer amount in kobo, so the Naira figure is rounded to the nearest kobo
 * (₦1,250.50 must charge exactly 125050 kobo).
 */
function toKobo(amount: unknown): number | null {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return null;
  }

  if (amount < MIN_AMOUNT_NAIRA || amount > MAX_AMOUNT_NAIRA) {
    return null;
  }

  const kobo = Math.round(amount * 100);
  return kobo >= MIN_AMOUNT_NAIRA * 100 ? kobo : null;
}

// POST /api/payments/create-link
// Turns an amount the owner wants to collect into a Paystack checkout URL they
// can send inside a conversation. It is a one-off charge: no plan code goes out,
// so Paystack creates no subscription, and the callback lands on the
// customer-facing confirmation page rather than the owner's billing screen.
//
// Only the signed-in owner's own business can be charged to. The body carries a
// businessId (the chat already knows which tenant it is in) and it must match
// the session, so a caller cannot mint links against another business.
export async function POST(request: Request) {
  try {
    const sessionBusinessId = await getCurrentBusinessId();

    if (!sessionBusinessId) {
      return unauthorized();
    }

    const body = (await request
      .json()
      .catch(() => null)) as CreateLinkBody | null;

    if (!body) {
      return badRequest("A JSON body is required");
    }

    const businessId =
      typeof body.businessId === "string" ? body.businessId.trim() : "";

    if (!businessId) {
      return badRequest("businessId is required");
    }

    if (businessId !== sessionBusinessId) {
      return Response.json(
        { error: "businessId does not belong to this account" },
        { status: 403 },
      );
    }

    const amountKobo = toKobo(body.amount);

    if (amountKobo === null) {
      return badRequest(
        `amount must be a number of Naira between ${MIN_AMOUNT_NAIRA} and ${MAX_AMOUNT_NAIRA}`,
      );
    }

    const customerEmail =
      typeof body.customerEmail === "string" ? body.customerEmail.trim() : "";

    if (!isValidEmail(customerEmail)) {
      return badRequest("A valid customerEmail is required");
    }

    // Intentionally not logged: the payload carries the customer's email
    // address. The webhook event is the place the outcome is recorded.
    const initialized = await initializeTransaction({
      email: customerEmail,
      amountKobo,
      // Absolute URL because Paystack redirects the customer's browser;
      // /chat/success is the public confirmation page. `getAppUrl()` throws
      // when NEXT_PUBLIC_APP_URL is unset, so a misconfigured deploy fails
      // loudly instead of sending a paying customer to localhost.
      callbackUrl: `${getAppUrl()}/chat/success`,
      // Echoed back on the webhook so the charge can be traced to this flow: an
      // in-chat payment is neither a subscription nor a credit top-up, so the
      // billing webhook records nothing against the wallet.
      metadata: { type: "chat_payment", businessId },
    });

    return Response.json({
      authorization_url: initialized.authorization_url,
      reference: initialized.reference,
      amount: amountKobo / 100,
    });
  } catch (error) {
    console.error("[POST /api/payments/create-link]", error);
    const detail = error instanceof Error ? error.message : String(error);
    return Response.json(
      { error: "Failed to create payment link", detail },
      { status: 500 },
    );
  }
}
