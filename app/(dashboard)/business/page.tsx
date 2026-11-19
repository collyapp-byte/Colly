import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeBusiness } from "@/lib/business";
import type { Business } from "@/lib/business";
import { formatNaira } from "@/lib/format";

const HEADING_CLASS = "font-display text-base tracking-wide text-main";

export default async function BusinessPage() {
  await connection();
  const user = await requireAuth();

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
  });
  if (!business) {
    notFound();
  }

  const [rawProducts, rawFaqs, customers] = await Promise.all([
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

  const products = rawProducts.map((p) => ({
    ...p,
    price: Number(p.price),
    stock: p.stock ?? undefined,
  }));

  const faqs = rawFaqs.map((f) => ({
    ...f,
    category: f.category ?? undefined,
  }));

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
            code -- all in one place.
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-card-ring bg-card-surface px-4 py-2 text-sm font-semibold text-main shadow-sm transition-all duration-250 hover:-translate-y-0.5 hover:border-colly/40 hover:shadow-md active:translate-y-0 active:scale-[0.98]"
        >
          Account & billing {"\u003e"}
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

type CustomerRow = {
  id: string;
  name: string | null;
  phone?: string | null;
  email?: string | null;
};

interface BusinessHubProps {
  business: Business;
  isOwner: boolean;
  products: { id: string; name: string; price: number; stock?: number }[];
  faqs: { id: string; question: string; answer: string; category?: string }[];
  customers: CustomerRow[];
}

function BusinessHub({
  business,
  isOwner,
  products,
  faqs,
  customers,
}: BusinessHubProps) {
  return (
    <div className="space-y-6">
      <section className="surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Business Profile</h2>
        <p className="mt-2 text-sm text-main">
          {business.name} -- {business.phone}
        </p>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Products & Catalogue</h2>
        <div className="mt-3 space-y-1">
          {products.slice(0, 6).map((p) => (
            <p key={p.id} className="text-sm text-main">
              {p.name} -- {formatNaira(p.price)}
            </p>
          ))}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>FAQs & Policies</h2>
        <div className="mt-3 space-y-1">
          {faqs.slice(0, 5).map((f) => (
            <p key={f.id} className="text-sm text-main">
              {f.question}
            </p>
          ))}
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Customer Directory</h2>
        <div className="mt-3 space-y-1">
          {customers.slice(0, 5).map((c) => (
            <p key={c.id} className="text-sm text-main">
              {c.name || "Customer"}
            </p>
          ))}
        </div>
      </section>

      {isOwner && (
        <section className="surface-card p-5 sm:p-6">
          <h2 className={HEADING_CLASS}>Team & Roles</h2>
          <Link href="/settings/team" className="mt-2 inline-block text-sm text-colly">
            Invite team members
          </Link>
        </section>
      )}

      <section className="surface-card p-5 sm:p-6">
        <h2 className={HEADING_CLASS}>Business QR Code</h2>
        <Link href="/settings/qr-code" className="mt-2 inline-block text-sm text-colly">
          Open QR Code Generator
        </Link>
      </section>
    </div>
  );
}
