import Script from "next/script";
import { Footer } from "@/components/ui/footer"; 
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { MarketingHeader } from "@/components/marketing/marketing-header";

export const metadata = {
  title: "Colly | AI Sales Assistant for Nigerian Businesses",
  description: "Stop losing sales to missed replies. Colly is the AI sales assistant that replies to your customers 24/7 in English or Pidgin. Start your free trial today.",
  openGraph: {
    title: "Colly | AI Sales Assistant",
    description: "Stop losing sales to missed replies. Reply 24/7 in English or Pidgin.",
    url: "https://colly.com.ng",
    siteName: "Colly",
    locale: "en_NG",
    type: "website",
    images: [{ url: "https://colly.com.ng/og-image.png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Colly | AI Sales Assistant",
    description: "Stop losing sales to missed replies.",
    images: ["https://colly.com.ng/og-image.png"],
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <>
      {umamiId && (
        <Script
          async
          src="https://cloud.umami.is/script.js"
          data-website-id={umamiId}
          strategy="afterInteractive"
        />
      )}
      
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
