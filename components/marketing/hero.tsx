"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { AnimatedItem, AnimatedSection } from "@/components/ui/animated-section";

/**
 * Marketing homepage hero. Client-only because of Framer Motion; the parent
 * page stays a Server Component so it can keep exporting `metadata`. The hero
 * is a single centered column: badge, headline, copy, CTAs and the photo
 * background layered behind the fixed glass header.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-[#FFF4EC] to-background">
      {/* Photo background sitting behind the fixed header and the hero copy. */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/hero.jpg"
          alt="Hero Background"
          fill
          className="object-cover object-center opacity-30"
          priority
        />
        {/* A soft gradient overlay so the text remains perfectly readable */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/50 to-transparent" />
      </div>

      {/* Animated floating gradient background: two blurred brand blobs that
          drift slowly, giving the hero depth without stealing attention. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="animate-colly-float absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#FF6600]/20 blur-3xl" />
        <div
          className="animate-colly-float absolute -right-32 top-16 h-96 w-96 rounded-full bg-amber-200/30 blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center justify-center px-4 pt-24 pb-12 text-center sm:pt-28 sm:pb-16">
        <AnimatedSection className="text-center">
          <AnimatedItem>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FF6600]/20 bg-white px-3 py-1 text-[13px] font-medium text-[#FF6600]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Built for Nigerian businesses
            </span>
          </AnimatedItem>

          <AnimatedItem as="h1" className="mt-6 font-display text-3xl leading-tight tracking-tight text-gray-900 sm:text-5xl">
            Stop losing sales to missed replies.
          </AnimatedItem>

          <AnimatedItem as="p" className="mx-auto mt-5 max-w-xl text-base text-gray-600 sm:text-lg">
            Colly is the AI sales assistant that replies 24/7. Keep your
            personal phone. Add a dedicated AI line.
          </AnimatedItem>

          <AnimatedItem className="mt-8 flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/signup"
                className="flex w-full items-center justify-center rounded-lg bg-[#FF6600] px-8 py-3.5 text-sm font-semibold text-white transition-all hover:scale-105 hover:bg-[#E65C00] active:scale-95 sm:w-auto"
              >
                Start Free Trial
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}>
              <Link
                href="/find-an-agent"
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-8 py-3.5 text-sm font-semibold text-gray-700 transition-all hover:scale-105 hover:bg-gray-50 active:scale-95 sm:w-auto"
              >
                Find an Agent
              </Link>
            </motion.div>
          </AnimatedItem>

          <AnimatedItem className="mt-4 text-[13px] text-gray-500">
            No SIM card required to start · Cancel anytime
          </AnimatedItem>
        </AnimatedSection>
      </div>
    </section>
  );
}
