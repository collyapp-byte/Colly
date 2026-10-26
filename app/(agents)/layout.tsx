import type { Metadata } from "next";
import { connection } from "next/server";
import { AgentShell } from "@/components/agents/agent-shell";
import { AgentBadge } from "@/components/agents/agent-badge";
import { Footer } from "@/components/ui/footer";
import { requireAgent } from "@/lib/agent-auth";

/*
 * Same constraint as the business dashboard layout: `next.config.ts` turns on
 * `cacheComponents`, so this layout must not set `export const dynamic`. The
 * auth check runs at the layout level (outside Suspense) so `requireAgent()`'s
 * redirect to /agents/login is not swallowed while streaming.
 */

/*
 * `instant = false` opts this segment out of the static-shell / instant-nav
 * validation that Cache Components runs, because the auth check below blocks on
 * purpose: the layout must resolve the agent before rendering so a signed-out
 * visitor is redirected to /agents/login instead of streaming a shell. Without
 * this, `next build` fails with "Route ... encountered uncached or runtime data
 * during prerendering".
 */
export const instant = false;

export const metadata: Metadata = {
  title: {
    default: "Agent Dashboard",
    template: "%s · Colly Agents",
  },
  // Every route in this group calls `requireAgent()` and bounces to
  // /agents/login when signed out, so nothing here should be indexed.
  robots: { index: false, follow: false },
};

export default async function AgentsLayout({ children }: { children: React.ReactNode }) {
  await connection();

  const agent = await requireAgent();

  return (
    <AgentShell agentBadge={<AgentBadge agent={agent} />}>
      {children}
      <Footer />
    </AgentShell>
  );
}
