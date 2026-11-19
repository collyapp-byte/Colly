import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Clock, MapPin, Phone, SlidersHorizontal } from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function BusinessProfilePage() {
  await connection();
  const user = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business) {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <header className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-colly">
            Business Profile
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-main sm:text-3xl">
            {business.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {business.description || "No business description added yet."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/business"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-3.5 py-2 text-sm font-medium text-main transition-all duration-200 hover:border-colly/40"
          >
            <ArrowLeft className="h-4 w-4" />
            Business Hub
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-colly px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-colly/90"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Edit in Settings
          </Link>
        </div>
      </header>

      <section className="surface-card p-5 sm:p-6">
        <h2 className="font-display text-sm font-semibold tracking-wide text-main">
          About & AI Context
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-main">
          {business.description ||
            "Add a short description of what your business sells so your AI assistant has accurate context when talking to customers."}
        </p>

        <dl className="mt-6 grid grid-cols-1 gap-4 border-t border-card-ring pt-5 sm:grid-cols-3">
          <div className="rounded-xl border border-card-ring bg-surface-muted/50 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Phone className="h-3.5 w-3.5 text-colly" />
              Phone Number
            </dt>
            <dd className="mt-1.5 text-sm font-semibold text-main">
              {business.phone}
            </dd>
          </div>

          <div className="rounded-xl border border-card-ring bg-surface-muted/50 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <Clock className="h-3.5 w-3.5 text-colly" />
              Operating Hours
            </dt>
            <dd className="mt-1.5 text-sm font-semibold text-main">
              {business.businessHours || "Not set"}
            </dd>
          </div>

          <div className="rounded-xl border border-card-ring bg-surface-muted/50 p-4">
            <dt className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <MapPin className="h-3.5 w-3.5 text-colly" />
              Address
            </dt>
            <dd className="mt-1.5 text-sm font-semibold text-main">
              {business.address || "Not set"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex items-center justify-between rounded-xl border border-card-ring bg-surface-muted/30 p-4 text-xs text-muted">
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-colly" />
            AI Tone: <strong className="text-main">{business.tone}</strong>
          </span>
          <Link href="/settings" className="font-semibold text-colly hover:underline">
            Update profile & tone →
          </Link>
        </div>
      </section>
    </div>
  );
}
