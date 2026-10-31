"use server";

import { revalidatePath } from "next/cache";

import { getCurrentBusinessId } from "@/lib/auth";
import { isBookingStatus } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";

/** The bookings page itself; revalidated after every status change. */
const BOOKINGS_PATH = "/bookings";

/** What the Confirm / Cancel buttons get back. */
export type BookingActionResult = { ok: true } | { ok: false; error: string };

/**
 * Confirms or cancels one appointment.
 *
 * Scoped by `businessId` from the session, exactly like the API routes: a
 * booking id from another tenant is "no longer exists", never a cross-tenant
 * write. The AI can only ever create a PENDING row (`create_booking` in
 * `lib/tools.ts`), so this is the one place a slot becomes CONFIRMED or
 * CANCELLED — my boss/oga's decision, taken in the dashboard.
 *
 * Transitions: PENDING → CONFIRMED | CANCELLED, CONFIRMED → CANCELLED (a slot
 * the owner already confirmed can still be freed). Nothing moves back to
 * PENDING, and a cancelled appointment stays cancelled.
 *
 * `status` is a `string`, not the union, because a Server Action is a network
 * endpoint: the type only describes the page's own calls, so the value is
 * validated with `isBookingStatus()` at runtime.
 */
export async function updateBookingStatus(
  bookingId: string,
  status: string,
): Promise<BookingActionResult> {
  if (!bookingId) {
    return { ok: false, error: "Missing appointment." };
  }

  if (!isBookingStatus(status) || status === "PENDING") {
    return { ok: false, error: "Unknown appointment status." };
  }

  const businessId = await getCurrentBusinessId();
  if (!businessId) {
    return { ok: false, error: "Your session has expired. Sign in again." };
  }

  try {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      select: { id: true, status: true },
    });

    if (!booking) {
      return { ok: false, error: "That appointment no longer exists." };
    }

    if (booking.status === status) {
      // Already there (a double click, a stale tab): success, nothing to write.
      revalidatePath(BOOKINGS_PATH);
      return { ok: true };
    }

    if (booking.status === "CANCELLED") {
      return { ok: false, error: "This appointment is already cancelled." };
    }

    if (status === "CONFIRMED" && booking.status !== "PENDING") {
      return { ok: false, error: "Only a pending appointment can be confirmed." };
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status },
    });

    revalidatePath(BOOKINGS_PATH);
    return { ok: true };
  } catch (error) {
    console.error("[updateBookingStatus]", error);
    return { ok: false, error: "Could not update the appointment. Please try again." };
  }
}
