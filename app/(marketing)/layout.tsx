import Script from "next/script";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/ui/footer"; 
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { NavbarAuthActions } from "@/components/marketing/navbar-auth-actions";

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
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/logo.svg" alt="Colly" width={30} height={30} priority />
                <span className="font-display text-lg tracking-tight text-gray-900">
                  Colly
                </span>
              </Link>
              <nav className="flex items-center gap-5">
                <Link
                  href="/find-an-agent"
                  className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
                >
                  Find an Agent
                </Link>
                <NavbarAuthActions />
              </nav>
            </div>
          </header>

          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </SmoothScroll>
    </>
  );
}
