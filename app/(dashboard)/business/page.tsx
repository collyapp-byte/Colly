import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BookOpen,
  Building2,
  HelpCircle,
  QrCode,
  Users,
} from "lucide-react";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/format";

export default async function BusinessPage() {
  await connection();
  const user = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business) {
    notFound();
  }

  const [products, faqs, customers, teamCount] = await Promise.all([
    prisma.product.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.faq.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.customer.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.teamMember.count({
      where: { businessId: user.businessId },
    }),
  ]);

  const isOwner = user.role === "OWNER";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center md:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-colly">
            Business Hub
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight text-main sm:text-3xl">
            {business.name}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {business.description || `${business.phone}${business.businessHours ? ` · ${business.businessHours}` : ""}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isOwner && (
            <Link
              href="/settings/team"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-colly px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-colly/90"
            >
              <Users className="h-4 w-4" />
              Team & Roles ({teamCount})
            </Link>
          )}
          <Link
            href="/business/profile"
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main transition-all duration-200 hover:border-colly/40"
          >
            View Profile
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-8">
          <Link
            href="/business/profile"
            className="surface-card surface-panel surface-card-interactive flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-main">
                  <Building2 className="h-4 w-4 text-colly" />
                  Business Profile
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted" />
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                {business.description ||
                  "No business description added yet. Add what your business sells so your AI assistant has context."}
              </p>
              <p className="mt-2.5 text-xs font-medium text-main">
                {business.phone}
              </p>
              <p className="mt-1 text-xs text-muted">
                Hours: {business.businessHours || "Not set"}
              </p>
            </div>
            <p className="mt-4 text-xs font-semibold text-colly">
              Open business profile →
            </p>
          </Link>

          {isOwner ? (
            <Link
              href="/settings/team"
              className="surface-card surface-panel surface-card-interactive flex flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-main">
                    <Users className="h-4 w-4 text-colly" />
                    Team & Roles
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted" />
                </div>
                <p className="mt-3 text-2xl font-bold text-main">{teamCount}</p>
                <p className="mt-1 text-xs text-muted">
                  Invited staff members with workspace access
                </p>
              </div>
              <p className="mt-4 text-xs font-semibold text-colly">
                Manage team & invites →
              </p>
            </Link>
          ) : (
            <Link
              href="/channels"
              className="surface-card surface-panel surface-card-interactive flex flex-col justify-between p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-main">
                    <Users className="h-4 w-4 text-colly" />
                    Channels
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted" />
                </div>
                <p className="mt-3 text-xs text-muted">
                  View active messaging channels for your business.
                </p>
              </div>
              <p className="mt-4 text-xs font-semibold text-colly">
                Open Channels →
              </p>
            </Link>
          )}

          <Link
            href="/products"
            className="surface-card surface-panel surface-card-interactive flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-main">
                  <BookOpen className="h-4 w-4 text-colly" />
                  Products & Catalogue
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-3 space-y-1.5">
                {products.length === 0 ? (
                  <p className="text-xs text-muted">No products added yet.</p>
                ) : (
                  products.slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span className="truncate text-main">{p.name}</span>
                      <span className="shrink-0 font-medium text-muted">
                        {formatNaira(Number(p.price))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold text-colly">
              Open catalogue →
            </p>
          </Link>

          <Link
            href="/faqs"
            className="surface-card surface-panel surface-card-interactive flex flex-col justify-between p-5"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-main">
                  <HelpCircle className="h-4 w-4 text-colly" />
                  FAQs & Policies
                </span>
                <ArrowUpRight className="h-4 w-4 text-muted" />
              </div>
              <div className="mt-3 space-y-1.5">
                {faqs.length === 0 ? (
                  <p className="text-xs text-muted">No FAQs added yet.</p>
                ) : (
                  faqs.slice(0, 4).map((f) => (
                    <p key={f.id} className="truncate text-xs text-main">
                      {f.question}
                    </p>
                  ))
                )}
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold text-colly">
              Manage FAQs →
            </p>
          </Link>
        </div>

        <div className="space-y-5 lg:col-span-4">
          <section className="surface-card p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 font-display text-sm font-semibold text-main">
                <QrCode className="h-4 w-4 text-colly" />
                Shop QR Card
              </span>
              <Link
                href="/settings/qr-code"
                className="text-xs font-semibold text-colly hover:underline"
              >
                Download / Print
              </Link>
            </div>
            <p className="mt-2 text-xs text-muted">
              Share a counter QR card so customers can message {business.name} directly.
            </p>
            <div className="mt-4 flex items-center justify-between rounded-xl border border-card-ring bg-surface-muted/60 p-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-main">
                  {business.name}
                </p>
                <p className="truncate text-[11px] text-muted">
                  Ready for counter display & PNG download
                </p>
              </div>
              <Link
                href="/settings/qr-code"
                className="ml-2 shrink-0 rounded-lg bg-colly px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-colly/90"
              >
                Open QR
              </Link>
            </div>
          </section>

          <Link
            href="/customers"
            className="surface-card surface-panel surface-card-interactive block p-5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-sm font-semibold text-main">
                Customer Directory
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted" />
            </div>
            <div className="mt-3 space-y-1.5">
              {customers.length === 0 ? (
                <p className="text-xs text-muted">No customers recorded yet.</p>
              ) : (
                customers.slice(0, 4).map((c) => (
                  <p key={c.id} className="truncate text-xs text-main">
                    {c.name || c.phone || "Customer"}
                  </p>
                ))
              )}
            </div>
            <p className="mt-4 text-xs font-semibold text-colly">
              View all customers →
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
