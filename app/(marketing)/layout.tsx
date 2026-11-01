import { Footer } from "@/components/ui/footer";
import { MarketingHeader } from "@/components/marketing/marketing-header";

/*
 * No `metadata` export here on purpose. Marketing titles, descriptions and
 * canonicals are per page (`pageMetadata()` in `lib/seo.ts`), and a title set on
 * this layout would be run through the root template as well, producing
 * "… | Colly Nigeria | Colly Nigeria".
 *
 * No smooth-scroll wrapper either. Marketing pages scroll natively: the Lenis
 * wrapper that used to sit here intercepted wheel events and tweened them over
 * 1.2s, which felt laggy and accelerated on a trackpad. See the scrolling
 * contract in app/globals.css.
 */

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Analytics note: the Umami tracker is rendered once, in the root layout
  // (app/layout.tsx), so marketing pages must not add a second copy — a
  // duplicate <Script> would report every visit twice.
  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] bg-radial-[ellipse_at_top] from-orange-100/40 via-gray-50 to-blue-100/20 pt-20">
      <MarketingHeader />

      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
