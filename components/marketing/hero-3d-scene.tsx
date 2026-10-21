"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import {
  BarChart3,
  Clock3,
  MessageCircle,
  ShoppingBag,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

/**
 * Hero 3D scene.
 *
 * The Colly logo floats at the centre of a perspective stage, ringed by glassy
 * 3D icon tiles. Every element shares one float cycle (same duration, easing
 * and keyframes) so the logo rises and falls in sync with the icons orbiting
 * it.
 */

/** Shared float cycle: 4s, ease-in-out, infinite. */
const FLOAT_TRANSITION = {
  duration: 4,
  repeat: Infinity,
  ease: "easeInOut",
} as const;

/** Vertical keyframes shared by the logo and the orbiting icons. */
const FLOAT_KEYFRAMES = { y: [-10, 10, -10] };

type SceneIcon = {
  Icon: LucideIcon;
  label: string;
  /** Anchor point of the tile inside the stage, in percent. */
  left: string;
  top: string;
  /** Static 3D tilt so the tile reads as a solid block in perspective. */
  rotateX: number;
  rotateY: number;
  /** Depth on the Z axis — larger values sit closer to the viewer. */
  depth: number;
};

const SCENE_ICONS: SceneIcon[] = [
  { Icon: MessageCircle, label: "Instant replies", left: "15%", top: "24%", rotateX: 12, rotateY: -18, depth: 28 },
  { Icon: Clock3, label: "Always on", left: "78%", top: "16%", rotateX: 8, rotateY: 16, depth: 22 },
  { Icon: ShoppingBag, label: "Product catalogue", left: "19%", top: "74%", rotateX: -10, rotateY: 14, depth: 32 },
  { Icon: BarChart3, label: "Sales insights", left: "76%", top: "70%", rotateX: -12, rotateY: -14, depth: 20 },
  { Icon: Sparkles, label: "Smart AI answers", left: "50%", top: "8%", rotateX: 8, rotateY: 0, depth: 40 },
];

export function Hero3DScene() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div
        className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF6600]/90 via-[#FF8A3D]/80 to-amber-300 shadow-2xl"
        style={{ perspective: 1200 }}
      >
        {/* Soft light blobs that give the stage its depth. */}
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" aria-hidden />
        <div className="absolute -bottom-12 -left-8 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />

        {/* Contact shadow that grounds the floating logo. */}
        <div
          className="absolute left-1/2 top-1/2 h-40 w-40 rounded-[50%] bg-[#7A2E00]/25 blur-2xl"
          style={{ marginLeft: "-5rem", marginTop: "3rem" }}
          aria-hidden
        />

        {SCENE_ICONS.map(({ Icon, label, left, top, rotateX, rotateY, depth }) => (
          <motion.div
            key={label}
            className="absolute z-0 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 bg-white/85 shadow-[0_18px_30px_-12px_rgba(74,20,0,0.45)] backdrop-blur-sm"
            style={{
              left,
              top,
              marginLeft: "-1.75rem",
              marginTop: "-1.75rem",
              rotateX,
              rotateY,
              z: depth,
            }}
            animate={FLOAT_KEYFRAMES}
            transition={FLOAT_TRANSITION}
            aria-hidden
          >
            <Icon className="h-6 w-6 text-[#FF6600]" aria-hidden />
          </motion.div>
        ))}

        {/* Centre logo — floats up and down in sync with the orbiting icons. */}
        <div className="absolute inset-0">
          <motion.div
            className="absolute z-10 flex h-32 w-32 items-center justify-center rounded-full bg-white shadow-[0_0_50px_rgba(255,102,0,0.3)]"
            style={{ top: "50%", left: "50%", marginLeft: "-4rem", marginTop: "-4rem" }}
            animate={{
              y: [-10, 10, -10],
              boxShadow: [
                "0px 0px 30px rgba(255,102,0,0.2)",
                "0px 0px 60px rgba(255,102,0,0.5)",
                "0px 0px 30px rgba(255,102,0,0.2)"
              ]
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <Image src="/logo.svg" alt="Colly" width={72} height={72} className="h-16 w-16" priority />
          </motion.div>
        </div>
      </div>
    </div>
  );
}
