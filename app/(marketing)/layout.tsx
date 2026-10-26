import { Footer } from "@/components/ui/footer"; 
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { MarketingHeader } from "@/components/marketing/marketing-header";

/*
 * No `metadata` export here on purpose. Marketing titles, descriptions and
 * canonicals are per page (`pageMetadata()` in `lib/seo.ts`), and a title set on
 * this layout would be run through the root template as well, producing
 * "… | Colly Nigeria | Colly Nigeria".
 */

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Analytics note: the Umami tracker is rendered once, in the root layout
  // (app/layout.tsx), so marketing pages must not add a second copy — a
  // duplicate <Script> would report every visit twice.
  return (
    <>
      <SmoothScroll>
        <div className="flex min-h-screen flex-col bg-[#f8fafc] bg-radial-[ellipse_at_top] from-orange-100/40 via-gray-50 to-blue-100/20 pt-20">
          <MarketingHeader />

          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </SmoothScroll>
    </>
  );
}
