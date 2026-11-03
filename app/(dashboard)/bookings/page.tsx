import { connection } from "next/server";
import type { Metadata } from "next";

import { requireAuth } from "@/lib/auth";
import { isBookingStatus } from "@/lib/bookings";
import { prisma } from "@/lib/prisma";
import { formatInLagosTimezone } from "@/lib/timezone";
import { BackButton } from "@/components/ui/back-button";
import {
  BookingsList,
  type BookingRow,
} from "@/components/dashboard/bookings-list";

export const metadata: Metadata = {
  title: "Bookings",
};

/**
 * How many appointments the schedule renders. A guard rail like
 * `LIST_PAGE_SIZE`: the composite `(businessId, startTime)` index keeps this
 * read cheap, and the page says so when it hits the cap instead of silently
 * truncating. A keyset pager can hang off a future `GET /api/bookings`.
 */
const MAX_BOOKINGS_SHOWN = 100;

/**
 * The appointment schedule (owner and staff alike: working the diary is a
 * day-to-day task, not a billing or channel setting).
 *
 * A Server Component so the first paint already has the appointments: the rows
 * come straight from Prisma and every date is rendered in **Africa/Lagos** here,
 * once — never with the browser's own zone.
 *
 * `connection()` keeps the page out of the prerender, exactly like the dashboard
 * overview and the team page: `requireAuth()` reads the Supabase session and the
 * rows are per-tenant. `export const dynamic = "force-dynamic"` is not an option
 * with `cacheComponents: true`.
 *
 * Status changes go through the `updateBookingStatus` Server Action in
 * `./actions.ts`, which re-checks the tenant on every call.
 */
export default async function BookingsPage() {
  await connection(); // prerendering stops here

  const user = await requireAuth();

  const rows = await prisma.booking.findMany({
    where: { businessId: user.businessId },
    // Soonest first. Ordered by `startTime` so the `(businessId, startTime)`
    // index added in migration 20261104000000_add_bookings serves the read; the
    // id tie-breaker keeps two slots at the same instant stable between renders.
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
    take: MAX_BOOKINGS_SHOWN,
    select: {
      id: true,
      serviceName: true,
      startTime: true,
      status: true,
      notes: true,
      customer: { select: { name: true, phone: true } },
    },
  });

  const bookings: BookingRow[] = rows.map((row) => ({
    id: row.id,
    customerName: row.customer.name || row.customer.phone,
    customerPhone: row.customer.phone,
    serviceName: row.serviceName,
    startTimeLagos: formatInLagosTimezone(row.startTime),
    // `status` is a string column; anything unexpected is read as PENDING, the
    // value a new appointment always has (lib/bookings.ts#BOOKING_STATUSES).
    status: isBookingStatus(row.status) ? row.status : "PENDING",
    notes: row.notes,
  }));

  const pendingCount = bookings.filter(
    (booking) => booking.status === "PENDING",
  ).length;
  const truncated = rows.length === MAX_BOOKINGS_SHOWN;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <BackButton />
      <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
        Bookings
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        Appointments your AI booked in chat, in Africa/Lagos time. Confirm a slot
        or cancel it — the customer is not messaged automatically.
      </p>

      {bookings.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            {pendingCount} awaiting confirmation
          </span>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
            {bookings.length} booked
          </span>
        </div>
      )}

      <BookingsList bookings={bookings} />

      {truncated && (
        <p className="mt-4 text-xs text-gray-500">
          Showing the first {MAX_BOOKINGS_SHOWN} appointments, soonest first.
        </p>
      )}
    </div>
  );
}
