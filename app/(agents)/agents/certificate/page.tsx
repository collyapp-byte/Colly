"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Check, Copy, Download, TriangleAlert } from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import type { AgentCertificateResponse } from "@/lib/agents-types";

export default function AgentCertificatePage() {
  const { data, error, loading } = useAgentData<AgentCertificateResponse>(
    "/api/agents/certificate",
  );
  const [copied, setCopied] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <div className="h-80 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>{error ?? "We couldn't load your certificate."}</p>
      </div>
    );
  }

  if (!data.certified || !data.certificate) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-xl border border-panel-border bg-white p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
            <Award className="h-7 w-7" aria-hidden />
          </div>
          <h1 className="mt-4 font-display text-2xl text-gray-900">
            Not certified yet
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Complete every course and pass each quiz to earn your certificate.
          </p>
          <Link
            href="/agents/training"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
          >
            Go to training
          </Link>
        </div>
      </div>
    );
  }

  const { certificate, agent } = data;
  const issuedDate = new Date(certificate.issuedAt).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/verify/${agent.agentNumber}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be blocked; the link is shown in full regardless.
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-gray-900">Your certificate</h1>
          <p className="mt-1 text-sm text-gray-500">
            Download it or share your verification link with businesses.
          </p>
        </div>
        <a
          href="/api/agents/certificate/pdf"
          className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00] sm:mt-0"
        >
          <Download className="h-4 w-4" aria-hidden />
          Download PDF
        </a>
      </div>

      {/* On-screen certificate */}
      <div className="mt-5 rounded-2xl border-2 border-colly bg-white p-6 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <span className="font-display text-2xl tracking-[0.2em] text-colly">
            COLLY
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-gray-400">
            Agent Certification
          </span>

          <h2 className="mt-6 font-display text-3xl text-gray-900">
            Certificate of Completion
          </h2>
          <p className="mt-3 text-sm text-gray-500">
            This certificate is proudly presented to
          </p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {agent.fullName}
          </p>
          <div className="mt-3 h-px w-64 bg-gray-200" />
          <p className="mt-4 max-w-md text-sm text-gray-500">
            for successfully completing the Colly Agent training programme and
            being certified to set up and configure Colly for businesses.
          </p>

          <div className="mt-8 grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3">
            <Meta label="Agent ID" value={agent.agentNumber} />
            <Meta label="Certificate ID" value={certificate.certificateId} />
            <Meta label="Issued" value={issuedDate} />
          </div>
        </div>
      </div>

      {/* Verification link */}
      <div className="mt-5 rounded-xl border border-panel-border bg-white p-5">
        <p className="text-[13px] font-medium text-gray-700">
          Public verification link
        </p>
        <p className="mt-1 text-[13px] text-gray-500">
          Anyone can open this to confirm your certification.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-600">
            /verify/{agent.agentNumber}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-success" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-[13px] font-medium text-gray-800">{value}</p>
    </div>
  );
}
