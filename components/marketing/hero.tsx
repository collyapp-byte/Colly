"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { AnimatedItem, AnimatedSection } from "@/components/ui/animated-section";

/**
 * Marketing homepage hero. Client-only because of Framer Motion; the parent
 * page stays a Server Component so it can keep exporting `metadata`. The 3D
 * illustration is a gradient placeholder until a Shapefest/Khagwal render is
 * dropped into `public/hero-3d.png`.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-[#FFF4EC] to-background">
      {/* Animated floating gradient background: two blurred brand blobs that
          drift slowly, giving the hero depth without stealing attention. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-colly-float absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#FF6600]/20 blur-3xl" />
        <div
          className="animate-colly-float absolute -right-32 top-16 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
      </div>

      <div className="relative mx-auto grid w-full max-w-5xl items-center gap-12 px-4 py-20 sm:py-28 lg:grid-cols-2">
        <AnimatedSection className="text-center lg:text-left">
          <AnimatedItem>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6600]/20 bg-white px-3 py-1 text-[13px] font-medium text-[#FF6600]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Built for Nigerian businesses
            </span>
          </AnimatedItem>

          <AnimatedItem as="h1" className="mt-6 font-display text-3xl leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Stop losing sales to missed Telegram messages.
          </AnimatedItem>

          <AnimatedItem as="p" className="mt-5 max-w-xl text-base text-gray-600 sm:text-lg lg:mx-0 mx-auto">
            Colly is the AI sales assistant that replies 24/7. Keep your
            personal phone. Add a dedicated AI line.
          </AnimatedItem>

          <AnimatedItem className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="w-full rounded-lg bg-[#FF6600] px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#E65C00] sm:w-auto"
              >
                Start Free Trial
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/find-an-agent"
                className="w-full rounded-lg border border-gray-200 bg-white px-8 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:w-auto"
              >
                Find an Agent
              </Link>
            </motion.div>
          </AnimatedItem>

          <AnimatedItem className="mt-4 text-[13px] text-gray-500">
            No SIM card required to start · Cancel anytime
          </AnimatedItem>
        </AnimatedSection>

        {/* 3D asset placeholder — swap the gradient block below for a real
            <Image src="/hero-3d.png" ... /> once a Shapefest/Khagwal render is
            dropped into public/. Kept as a styled div for now so production
            never logs a 404 for a missing asset. */}
        <div className="relative mx-auto hidden w-full max-w-md lg:block">
          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF6600]/90 via-[#FF8A3D]/80 to-amber-300 shadow-2xl">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
            <Send
              className="h-24 w-24 text-white/90 drop-shadow-lg"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </section>
  );
}
