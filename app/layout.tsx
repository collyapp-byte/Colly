import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { SplashScreen } from "@/components/ui/splash-screen";
import { TopLoader } from "@/components/ui/top-loader";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Colly",
    template: "%s · Colly",
  },
  description: "Colly is an AI business assistant for Nigerian SMEs.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body className="min-h-full bg-background font-sans text-gray-900 antialiased">
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
