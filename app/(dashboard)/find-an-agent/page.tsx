import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { AgentDirectory } from "@/components/public/agent-directory";

export const metadata: Metadata = {
  title: "Find a Colly Agent",
  description:
    "Connect with a certified Colly agent in your state to set up your WhatsApp AI assistant.",
};

/**
 * Certified agent directory, rendered inside the dashboard shell so the
 * sidebar link navigates in place instead of opening the public shell in a
 * separate tab.
 *
 * The header renders immediately; the agent list lives behind a Suspense
 * boundary and `connection()`, so the page is never prerendered with a stale
 * list and never hits the database during `next build`.
 */
export default function FindAnAgentPage() {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">
        Find a Colly Agent
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-gray-600">
        Connect with a certified expert in your state to set up your WhatsApp
        AI.
      </p>

      <Suspense fallback={<DirectoryFallback />}>
        <CertifiedAgents />
      </Suspense>
    </div>
  );
}

async function CertifiedAgents() {
  await connection(); // prerendering stops here

  const agents = await prisma.agent.findMany({
    where: { certifiedAt: { not: null } },
    select: {
      fullName: true,
      agentNumber: true,
      phone: true,
      state: true,
    },
    orderBy: { fullName: "asc" },
  });

  return <AgentDirectory agents={agents} />;
}

function DirectoryFallback() {
  return (
    <div className="mt-8" aria-busy="true">
      <div className="h-10 w-56 animate-pulse rounded-lg bg-gray-100" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-xl border border-gray-100 bg-gray-100/60"
          />
        ))}
      </div>
    </div>
  );
}
