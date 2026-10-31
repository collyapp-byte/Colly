-- Booking System: an appointment the business sells (a haircut, a repair, a
-- consultation), owned by the tenant and attached to one of its customers.
--
-- Timezone contract: "startTime"/"endTime" are TIMESTAMPTZ, i.e. absolute
-- instants. The column never stores a wall clock, so comparisons stay correct
-- whatever the session's TimeZone is, and the Africa/Lagos (UTC+1) rendering
-- happens in the app — lib/timezone.ts#formatInLagosTimezone, applied by
-- lib/bookings.ts#serializeBooking — not in the storage format.
--
-- "status" starts at PENDING and moves to CONFIRMED or CANCELLED; it is text,
-- like "Invoice"."status" and "Customer"."dealStatus". "createdAt" follows the
-- rest of the schema (plain TIMESTAMP(3), always written as UTC).
--
-- Both foreign keys cascade: deleting a business or a customer removes their
-- bookings.
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- The schedule (a day, a week, the next appointment) reads a tenant's bookings
-- by start time.
CREATE INDEX "Booking_businessId_startTime_idx" ON "Booking"("businessId", "startTime");

-- CreateIndex
-- A customer's appointment history, and the cascade path from Customer.
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
