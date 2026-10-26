import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SplashScreen } from "@/components/ui/splash-screen";
import { TopLoader } from "@/components/ui/top-loader";
import { JsonLd } from "@/components/seo/json-ld";
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo";
import {
  OG_IMAGE,
  SITE_BRAND,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_LOCALE,
  SITE_NAME,
  SITE_TITLE_DEFAULT,
  SITE_TITLE_TEMPLATE,
  SITE_URL,
} from "@/lib/site";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/**
 * Site-wide metadata. Pages override this with `pageMetadata()` from
 * `lib/seo.ts`, which returns a complete, self-referential object (title,
 * description, canonical, Open Graph, Twitter). Two rules matter here:
 *
 * - `title.template` appends "| Colly Nigeria" to every page title. The home
 *   page opts out with `title.absolute` because its title already carries the
 *   brand.
 * - There is deliberately NO `alternates.canonical` at this level: a canonical
 *   set on the root layout is inherited by every page that does not define its
 *   own, which would point the privacy policy and the pricing page at `/`.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE_DEFAULT,
    template: SITE_TITLE_TEMPLATE,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: SITE_KEYWORDS,
  authors: [{ name: "Colly Team", url: SITE_URL }],
  creator: SITE_BRAND,
  publisher: SITE_NAME,
  category: "business software",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    title: SITE_TITLE_DEFAULT,
    description: SITE_DESCRIPTION,
    // No `url` here: a page-level `pageMetadata()` supplies its own. Leaving it
    // out stops private pages that inherit this block from claiming to be `/`.
    images: [
      {
        url: OG_IMAGE.path,
        width: OG_IMAGE.width,
        height: OG_IMAGE.height,
        type: OG_IMAGE.type,
        alt: OG_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Colly | AI Sales Assistant for Nigerian SMEs",
    description:
      "Automate customer service on Telegram, Discord and Web Chat with Nigerian Pidgin support.",
    // The descriptor form (not a bare path) so Next emits `twitter:image:alt`,
    // which X reads aloud for screen-reader users.
    images: [{ url: OG_IMAGE.path, alt: OG_IMAGE.alt }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Umami analytics: the tracker lives in the ROOT layout so every route —
  // marketing pages, auth screens and the dashboard — reports a pageview.
  // Optional by design: with no website ID configured (local clones, preview
  // deploys) the <Script> is not rendered at all and nothing is sent.
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

  return (
    <html lang="en-NG" className={`h-full scroll-smooth ${inter.variable}`}>
      <body className="min-h-full bg-background font-sans text-gray-900 antialiased">
        {/* Publisher + site identity, referenced by @id from every page's
            JSON-LD, so crawlers resolve one "Colly Nigeria" entity. */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        {umamiWebsiteId && (
          <Script
            async
            src="https://cloud.umami.is/script.js"
            data-website-id={umamiWebsiteId}
            strategy="afterInteractive"
          />
        )}
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <SplashScreen />
        {children}
        <Toaster
          position="bottom-right"
          richColors
          expand={true}
          closeButton
          duration={4000}
        />
      </body>
    </html>
  );
}

