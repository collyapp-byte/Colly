import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { SplashScreen } from "@/components/ui/splash-screen";
import { TopLoader } from "@/components/ui/top-loader";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Colly",
    template: "%s · Colly",
  },
  description: "Colly is an AI business assistant for Nigerian SMEs.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full scroll-smooth ${inter.variable}`}>
      <body className="min-h-full bg-background font-sans text-gray-900 antialiased">
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
