"use client";
import { motion } from "framer-motion";

export function Marquee() {
  const text = "AI REPLIES 24/7 • PIDGIN SUPPORT • SMART ESCALATION • WAYBILL AUTOMATION • ";
  return (
    <div className="relative flex overflow-hidden border-y border-gray-200 bg-[#1E3A8A] py-4 text-white">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, ease: "linear", duration: 15 }}
        className="whitespace-nowrap text-xl font-bold tracking-widest uppercase opacity-80"
      >
        {text + text + text}
      </motion.div>
    </div>
  );
}
