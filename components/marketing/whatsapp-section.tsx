"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function WhatsAppSection() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("loading");
    
    const formData = new FormData(e.currentTarget);
    const whatsapp = formData.get("whatsapp");
    const email = formData.get("email");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whatsapp, email }),
      });
      
      if (!res.ok) throw new Error("Failed");
      setStatus("success");
      (e.target as HTMLFormElement).reset();
      toast.success("You're on the WhatsApp waitlist! We will message you soon.");
    } catch {
      setStatus("error");
      toast.error("Could not join waitlist. Please try again.");
    }
  }

  return (
    <section className="bg-[#1E3A8A] py-16 sm:py-24 text-white">
      <div className="mx-auto max-w-4xl px-4 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-blue-100">
          <MessageCircle className="h-4 w-4" /> Coming Soon
        </div>
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Waiting for WhatsApp?</h2>
        <p className="mt-4 text-blue-100 max-w-xl mx-auto">
          We are currently working with Meta to unlock official WhatsApp API access for Nigerian businesses. Join the waitlist to get notified the day it launches.
        </p>

        {status === "success" ? (
          <div className="mt-8 rounded-xl bg-green-500/20 p-4 text-green-100 border border-green-500/30 max-w-md mx-auto">
            You're on the list! We'll message you on WhatsApp as soon as we launch.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 mx-auto flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="tel"
              name="whatsapp"
              required
              placeholder="WhatsApp Number"
              className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-blue-200 outline-none ring-2 ring-transparent focus:ring-white/30 transition-all"
            />
            <input
              type="email"
              name="email"
              placeholder="Email (optional)"
              className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-blue-200 outline-none ring-2 ring-transparent focus:ring-white/30 transition-all"
            />
            <Button
              type="submit"
              isLoading={status === "loading"}
              className="w-full sm:w-auto bg-[#FF6600]"
            >
              {status === "loading" ? "Joining..." : "Join Waitlist"}
            </Button>
          </form>
        )}
        {status === "error" && <p className="mt-4 text-red-300 text-sm">Something went wrong. Please try again.</p>}
      </div>
    </section>
  );
}
