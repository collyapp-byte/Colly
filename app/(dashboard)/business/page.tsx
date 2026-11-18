import { connection } from "next/server";
import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeBusiness } from "@/lib/business";
import type { Business } from "@/lib/business";
import { formatNaira } from "@/lib/format";

const HEADING_CLASS = "font-display text-base tracking-wide text-main";

import { notFound } from "next/navigation";

export default async function BusinessPage() {
  await connection();
  const user = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business) {
    notFound();
  }

  const [products, faqs, customers] = await Promise.all([
    prisma.product.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.faq.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.customer.findMany({
      where: { businessId: user.businessId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="surface-card flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center md:p-6">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-colly">
            Business
          </p>
          <h1 className="mt-1.5 font-display text-2xl font-bold tracking-tight text-main sm:text-3xl">
            {business.name}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Your business profile, catalogue, policies, customers, team and QR
            code — all in one place.
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
        >
          Account &amp; billing →
        </Link>
      </header>

      <BusinessHub
        business={serializeBusiness(business)}
        isOwner={user.role === "OWNER"}
        products={products}
        faqs={faqs}
        customers={customers}
      />
    </div>
  );
}

function ProductsCard({ products }: { products: { id: string; name: string; price: number; stock?: number }[] }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/products"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
        >
          <PlusIcon /> Manage full catalogue
        </Link>
        {products.length > 0 ? (
          <span className="text-sm text-muted">
            {products.length} product{products.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-sm text-muted">No products yet</span>
        )}
      </div>
      {products.length === 0 ? (
        <p className="mt-4 text-sm text-muted text-center surface-card p-6">
          Add products so the AI can recommend them to customers.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.slice(0, 6).map((product) => (
            <div key={product.id} className="surface-card p-3 flex flex-col gap-2">
              <p className="text-sm font-semibold text-main truncate">
                {product.name}
              </p>
              <p className="text-xs font-bold text-colly">
                {formatNaira(Number(product.price))}
              </p>
              {product.stock !== undefined && (
                <p className="text-[10px] text-muted">
                  {product.stock === 0 ? "Out of stock" : "In stock"}
                </p>
              )}
            </div>
          ))}
          {products.length > 6 && (
            <p className="mt-2 text-xs text-muted">
              +{products.length - 6} more — manage all in Products
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
  }

function BusinessProfileCard({ business }: { business: Business }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="surface-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
          Business name
        </p>
        <p className="text-lg font-semibold text-main">{business.name}</p>
      </div>
      <div className="surface-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
          Phone
        </p>
        <p className="text-lg font-semibold text-main">{business.phone}</p>
      </div>
      <div className="surface-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
          WhatsApp
        </p>
        <p className="text-lg font-semibold text-main">
          {business.whatsappNumber || "—"}
        </p>
      </div>
      <div className="col-span-full surface-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
          Operating hours
        </p>
        <p className="text-lg font-semibold text-main">
          {business.businessHours || "—"}
        </p>
      </div>
      <div className="col-span-full surface-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
          Description
        </p>
        <p className="text-lg font-semibold text-main">
          {business.description ||
            "No description set — add one to help the AI understand your business."}
        </p>
      </div>
      <div className="col-span-full surface-card p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted mb-2">
          Payment instructions
        </p>
        <p className="text-lg font-semibold text-main">
          {business.paymentInstructions || "—"}
        </p>
      </div>
    </div>
  );
}

function FaqsCard({ faqs }: { faqs: { id: string; question: string; answer: string; category?: string }[] }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/faqs"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
        >
          Manage FAQs
        </Link>
        <span className="text-sm text-muted">
          {faqs.length} FAQ{faqs.length !== 1 ? "s" : ""}
        </span>
      </div>
      {faqs.length === 0 ? (
        <p className="mt-4 text-sm text-muted text-center surface-card p-6">
          Teach your AI answers to common questions like delivery times and
          payment methods.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {faqs.slice(0, 5).map((faq) => (
            <div key={faq.id} className="surface-card p-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-main">
                  {faq.question}
                </p>
                <p className="mt-0.5 text-xs text-muted">{faq.answer}</p>
              </div>
            </div>
          ))}
          {faqs.length > 5 && (
            <p className="mt-2 text-xs text-muted">
              +{faqs.length - 5} more — manage all in FAQs
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CustomersCard({ customers }: { customers: { id: string; name: string; email: string }[] }) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Link
          href="/customers"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
        >
          Manage customers
        </Link>
        <span className="text-sm text-muted">
          {customers.length} customer{customers.length !== 1 ? "s" : ""}
        </span>
      </div>
      {customers.length === 0 ? (
        <p className="text-sm text-muted text-center surface-card p-6">
          Customers appear here when they message your business.
        </p>
      ) : (
        <div className="space-y-2">
          {customers.slice(0, 5).map((customer) => (
            <div
              key={customer.id}
              className="surface-card p-3 flex items-center gap-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted">
                {customer.name?.charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-main truncate">
                  {customer.name}
                </p>
                <p className="text-[10px] text-muted truncate">
                  {customer.phone}
                </p>
              </div>
              <Link
                href={`/customers/${customer.id}`}
                className="text-xs font-medium text-colly hover:underline"
              >
                View
              </Link>
            </div>
          ))}
          {customers.length > 5 && (
            <p className="mt-2 text-xs text-muted">
              +{customers.length - 5} more — manage all in Customers
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function TeamCard() {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <Link
        href="/settings/team"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
      >
        Invite team members
      </Link>
      <p className="text-sm text-muted">
        Invite staff to help with conversations, customers and products. Billing
        and channel settings stay with the owner.
      </p>
    </div>
  );
}

function QrCard() {
  return (
    <div className="mt-4 flex flex-col items-center gap-4">
      <Link
        href="/settings/qr-code"
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
      >
        Open QR Code Generator
      </Link>
      <p className="text-sm text-muted text-center">
        Print a scannable counter card so customers can chat with your AI
        assistant.
      </p>
    </div>
  );
}

interface BusinessHubProps {
  business: Business;
  isOwner: boolean;
  products: { id: string; name: string; price: number; stock?: number }[];
  faqs: { id: string; question: string; answer: string; category?: string }[];
  customers: { id: string; name: string; email: string; phone: string }[];
}

function BusinessHub({
  business,
  isOwner,
  products,
  faqs,
  customers,
}: BusinessHubProps) {
  return (
    <div>
      <section className="surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Business Profile &amp; Description</h2>
        <BusinessProfileCard business={business} />
      </section>

      <section className="mt-6 surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Products &amp; Catalogue</h2>
        <ProductsCard products={products} />
      </section>

      <section className="mt-6 surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>FAQs &amp; Policies</h2>
        <FaqsCard faqs={faqs} />
      </section>

      <section className="mt-6 surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Customer Directory</h2>
        <CustomersCard customers={customers} />
      </section>

      {isOwner && (
        <section className="mt-6 surface-card p-5 sm:p-6">
          <h2 className={HEADING_CLASS}>Team &amp; Roles</h2>
          <TeamCard />
        </section>
      )}

      <section className="mt-6 surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Business QR Code</h2>
        <QrCard />
      </section>
    </div>
  );
}