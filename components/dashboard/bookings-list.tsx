"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, X } from "lucide-react";

import { updateBookingStatus } from "@/app/(dashboard)/bookings/actions";
import type { BookingStatus } from "@/lib/bookings";

export type BookingRow = {
  id: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  startTimeLagos: string;
  status: BookingStatus;
  notes: string | null;
};

const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
};

const STATUS_BADGE: Record<BookingStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_BADGE[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

export function BookingsList({ bookings }: { bookings: BookingRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticBookings, addOptimisticUpdate] = useOptimistic(
    bookings,
    (state, updatedBooking: { id: string; status: BookingStatus }) => {
      return state.map((booking) =>
        booking.id === updatedBooking.id
          ? { ...booking, status: updatedBooking.status }
          : booking
      );
    }
  );

  async function changeStatus(
    bookingId: string,
    status: "CONFIRMED" | "CANCELLED",
  ) {
    setError(null);

    startTransition(async () => {
      addOptimisticUpdate({ id: bookingId, status });

      try {
        const result = await updateBookingStatus(bookingId, status);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        router.refresh();
      } catch {
        setError("Could not update the appointment. Please try again.");
      }
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-dashed border-gray-200 bg-surface p-10 text-center">
        <CalendarClock className="mx-auto h-6 w-6 text-gray-400" aria-hidden />
        <p className="mt-3 text-sm text-gray-500">
          No appointments yet. When a customer books one in chat, it appears here
          for you to confirm.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {optimisticBookings.map((booking) => {
          return (
            <li
              key={booking.id}
              className="rounded-lg border border-gray-200 bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display font-semibold text-gray-900">
                    {booking.customerName}
                  </p>
                  <p className="text-xs text-gray-500">{booking.customerPhone}</p>

                  <p className="mt-2 text-sm font-medium text-gray-800">
                    {booking.serviceName}
                  </p>

                  <p className="mt-1 flex items-start gap-2 text-sm text-gray-700">
                    <CalendarClock
                      className="mt-0.5 h-4 w-4 shrink-0 text-gray-400"
                      aria-hidden
                    />
                    <span>
                      {booking.startTimeLagos}
                    </span>
                  </p>

                  {booking.notes && (
                    <p className="mt-2 text-sm text-gray-600">{booking.notes}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={booking.status} />
                  </div>

                  {booking.status === "PENDING" && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void changeStatus(booking.id, "CONFIRMED")}
                        aria-label={`Confirm appointment for ${booking.customerName}`}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-colly px-3 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
                      >
                        <Check className="h-4 w-4" aria-hidden />
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => void changeStatus(booking.id, "CANCELLED")}
                        aria-label={`Cancel appointment for ${booking.customerName}`}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" aria-hidden />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}