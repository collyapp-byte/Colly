import type { Agent } from "@prisma/client";
import { BadgeCheck, GraduationCap } from "lucide-react";

/**
 * The agent's ID and certification status for the top bar.
 *
 * The agent is resolved by the layout (`requireAgent()`), which runs the session
 * read at the layout level so its redirect to /agents/login is not swallowed by
 * a Suspense boundary. This component is therefore purely presentational.
 */
export function AgentBadge({ agent }: { agent: Agent }) {
  const certified = agent.certifiedAt !== null;

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[12px] font-medium text-gray-600">
        {agent.agentNumber}
      </span>
      {certified ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/5 px-2.5 py-1 text-[12px] font-medium text-success">
          <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
          Certified
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-700">
          <GraduationCap className="h-3.5 w-3.5" aria-hidden />
          In training
        </span>
      )}
    </div>
  );
}
