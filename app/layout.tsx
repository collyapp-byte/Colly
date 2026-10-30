import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { UmamiTracker } from "@/components/analytics/umami-tracker";
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

/**
 * `display: "optional"` instead of `"swap"`.
 *
 * With `swap` the browser paints the fallback immediately and then swaps in
 * Inter whenever it arrives — every swap re-measures every line of text, which
 * is the single biggest source of layout shift (CLS) on this site. `optional`
 * gives the font a ~100 ms block period: if Inter is not ready by then the
 * browser keeps the fallback for that page view and never swaps, so the text
 * box is laid out once. Next still emits a metric-compatible fallback
 * (`adjustFontFallback`, on by default) so the first paint already has the
 * final line heights. Because the file is self-hosted and preloaded by
 * `next/font`, it is warm on repeat visits, which is where the brand face
 * should show up anyway.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "optional",
});

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
  // Favicon. Google's favicon crawler only indexes raster formats (PNG/ICO) at a
  // stable URL, so the SVG we shipped before (`/logo.svg`) was never picked up
  // and search results showed the default globe. `/icon.png` is the 512x512 PNG
  // in `app/icon.png`, served by the file-convention route; the three keys cover
  // modern tabs (`icon`), the legacy `rel="shortcut icon"` link and the iOS
  // home-screen icon, all pointing at the one file so every crawler resolves it.
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Analytics are optional by design: with no ID configured (local clones,
  // preview deploys) the script is not rendered at all and nothing is sent.
  //
  // Umami: the `<Script>` lives in the ROOT layout so every route — marketing
  // pages, auth screens and the dashboard — is covered. `data-auto-pageview`
  // is off because `<UmamiTracker />` owns pageviews: it sees every App Router
  // navigation, whereas the script would also fire its own pageview for each
  // `history.pushState`, counting the same route twice.
  //
  // Clarity: session recordings and heatmaps, the vendor's inline snippet, only
  // when `NEXT_PUBLIC_CLARITY_ID` is set. `beforeInteractive` is deliberate:
  // Clarity should start recording before the page becomes interactive. In the
  // App Router Next queues inline `beforeInteractive` scripts in the server HTML
  // (here, inside `<head>`, as a `self.__next_s` entry) and the app bootstrap
  // runs them from `document.head` before hydration — `afterInteractive` would
  // only execute the snippet from a client effect, once hydration is done.
  const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

  return (
    <html lang="en-NG" className={`h-full scroll-smooth ${inter.variable}`}>
      <head>
        {clarityId && (
          <Script id="microsoft-clarity" strategy="beforeInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "${clarityId}");
            `}
          </Script>
        )}
      </head>
      <body className="min-h-full bg-background font-sans text-gray-900 antialiased">
        {/* Publisher + site identity, referenced by @id from every page's
            JSON-LD, so crawlers resolve one "Colly Nigeria" entity. */}
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={websiteJsonLd()} />
        {umamiWebsiteId && (
          <Script
            async
            id="umami-analytics"
            src="https://cloud.umami.is/script.js"
            data-website-id={umamiWebsiteId}
            data-auto-pageview="false"
            strategy="afterInteractive"
          />
        )}
        {umamiWebsiteId && (
          <Suspense fallback={null}>
            {/* `useSearchParams` needs a Suspense boundary so static routes can
                still be prerendered. Renders nothing; sends the pageview. */}
            <UmamiTracker />
          </Suspense>
        )}
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        {/* The splash screen deliberately does NOT live here. It is a
            full-viewport `z-[100]` overlay that holds for 500 ms + a 200 ms
            fade, so it would cover the marketing hero's LCP element and delay
            first paint by ~0.7 s on every landing. It now lives in the
            dashboard layout only (app/(dashboard)/layout.tsx). */}
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

