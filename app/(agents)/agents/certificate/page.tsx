"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Award,
  Check,
  ChevronDown,
  Copy,
  Download,
  Image as ImageIcon,
  TriangleAlert,
} from "lucide-react";
import { useAgentData } from "@/components/agents/use-agent-data";
import { AgentCertificationBadge } from "@/components/agents/agent-certification-badge";
import type { AgentCertificateResponse } from "@/lib/agents-types";

export default function AgentCertificatePage() {
  const { data, error, loading } = useAgentData<AgentCertificateResponse>(
    "/api/agents/certificate",
  );
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [menuOpen]);

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
            Complete every course, earn all four badges, and pass the final
            certification exam to earn your certificate.
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
  const issuedYear = new Date(certificate.issuedAt).getFullYear();

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-gray-900">Your certificate</h1>
          <p className="mt-1 text-sm text-gray-500">
            Download it or share your verification link with businesses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Download badge (dropdown: PNG / SVG) */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <ImageIcon className="h-4 w-4" aria-hidden />
              Download badge
              <ChevronDown className="h-4 w-4" aria-hidden />
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
              >
                <a
                  role="menuitem"
                  href="/api/agents/certificate/badge"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  PNG
                  <span className="text-xs text-gray-400">500×500</span>
                </a>
                <a
                  role="menuitem"
                  href="/api/agents/certificate/badge?format=svg"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  SVG
                  <span className="text-xs text-gray-400">vector</span>
                </a>
              </div>
            )}
          </div>

          {/* Download certificate (PDF) */}
          <a
            href="/api/agents/certificate/pdf"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download certificate
          </a>

          {/* Copy share link */}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-success" aria-hidden />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden />
                Copy share link
              </>
            )}
          </button>
        </div>
      </div>

      {/* Shareable badge (inline SVG — same artwork as the download route) */}
      <div className="mt-5 flex flex-col items-center gap-3 rounded-2xl border border-panel-border bg-white p-6 sm:flex-row sm:justify-center sm:gap-8 sm:p-8">
        <AgentCertificationBadge
          fullName={agent.fullName}
          year={issuedYear}
          size={220}
        />
        <div className="max-w-xs text-center sm:text-left">
          <h2 className="font-display text-lg text-gray-900">
            Your certified badge
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Use the PNG for LinkedIn and social profiles, or grab the SVG for
            print and high-resolution use.
          </p>
          <a
            href="/api/agents/certificate/badge"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-[#FF6600] hover:underline"
          >
            <Download className="h-4 w-4" aria-hidden />
            Download PNG
          </a>
        </div>
      </div>

      {/* On-screen certificate */}
      <div className="mt-5 rounded-2xl border-2 border-colly bg-white p-6 sm:p-10">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Colly"
            width={64}
            height={64}
            className="h-16 w-16"
          />
          <span className="mt-2 font-display text-2xl tracking-[0.2em] text-colly">
            COLLY
          </span>
          <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.3em] text-gray-400">
            Agent Certification Programme
          </span>

          <p className="mt-6 text-sm text-gray-500">This certifies that</p>
          <p className="mt-2 text-2xl font-semibold text-gray-900">
            {agent.fullName}
          </p>
          <div className="mt-3 h-px w-64 bg-gray-200" />
          <p className="mt-4 max-w-md text-sm text-gray-500">
            has successfully completed all four course requirements and passed
            the Final Certification Exam
          </p>
          <p className="mt-6 font-display text-xl tracking-[0.2em] text-colly">
            CERTIFIED
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
        <code className="mt-3 block truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] text-gray-600">
          /verify/{agent.agentNumber}
        </code>
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
