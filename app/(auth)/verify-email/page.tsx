"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ClipboardEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthAlert } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";

type VerifyState =
  | { kind: "checking" }
  | { kind: "otp" }
  | { kind: "verified" }
  | { kind: "error"; message: string };

const GENERIC_ERROR =
  "This verification link is invalid or has expired. Enter the 6-digit code from your email below.";

function messageFromParams(params: URLSearchParams): string | null {
  const description = params.get("error_description");
  const code = params.get("error_code");
  const error = params.get("error");

  if (description) return `${GENERIC_ERROR} (${description})`;
  if (code) return `${GENERIC_ERROR} (${code})`;
  if (error) return `${GENERIC_ERROR} (${error})`;
  return null;
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email") ?? "";
  
  const [state, setState] = useState<VerifyState>({ kind: "checking" });
  const [email, setEmail] = useState(emailParam);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // 6-digit state
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const started = useRef(false);

  // Keep support for older link-based confirmation emails.
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function verifyLink() {
      const linkCode = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const paramError = messageFromParams(searchParams);

      if (paramError) {
        setState({ kind: "error", message: paramError });
        return;
      }

      if (!linkCode && !tokenHash) {
        setState({ kind: "otp" });
        return;
      }

      try {
        const supabase = createClient();

        if (linkCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(linkCode);
          if (error) {
            setState({ kind: "error", message: GENERIC_ERROR });
            return;
          }
          setState({ kind: "verified" });
          return;
        }

        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            type: (type as EmailOtpType | null) ?? "signup",
            token_hash: tokenHash,
          });
          if (error) {
            setState({ kind: "error", message: GENERIC_ERROR });
            return;
          }
          setState({ kind: "verified" });
        }
      } catch (error) {
        console.error("[verify-email]", error);
        setState({ kind: "error", message: GENERIC_ERROR });
      }
    }

    void verifyLink();
  }, [searchParams]);

  // Auto-focus first box when screen loads
  useEffect(() => {
    if (state.kind === "otp") {
      inputRefs.current[0]?.focus();
    }
  }, [state.kind]);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    if (value.length > 1) {
      const pasted = value.slice(0, 6).split("");
      pasted.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtp(newOtp);
      inputRefs.current[Math.min(index + pasted.length, 5)]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      inputRefs.current[Math.min(pasted.length, 5)]?.focus();
    }
  };

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const token = otp.join("");

    if (!trimmedEmail || token.length !== 6) {
      toast.error("Enter your email and the 6-digit code.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");
    
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: trimmedEmail,
        token,
        type: "signup",
      });

      if (error) {
        setErrorMsg(error.message || "Invalid or expired code");
        return;
      }

      toast.success("Email verified!");
      router.push("/dashboard");
    } catch {
      setErrorMsg("Could not verify the code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (state.kind === "checking") {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-surface text-sm text-gray-500">
        Verifying your email…
      </div>
    );
  }

  if (state.kind === "verified") {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8">
        <h1 className="font-display text-2xl text-gray-900">Email Verified!</h1>
        <div className="mt-6">
          <AuthAlert tone="success">
            Your email address has been confirmed. You&apos;re all set.
          </AuthAlert>
        </div>
        <Link href="/dashboard" className="mt-6 block">
          <Button variant="primary" className="w-full">
            Go to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  // THE BEAUTIFUL OTP SCREEN
  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-8 sm:p-12 max-w-md mx-auto w-full shadow-sm">
      
      {/* Mail Icon */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-colly/10 mb-6">
        <Mail className="h-10 w-10 text-colly" />
      </div>

      <h1 className="font-display text-2xl text-gray-900 text-center">
        Check verification code
      </h1>
      <p className="mt-2 text-sm text-gray-500 text-center">
        We&apos;ve sent a special code to your email,<br /> type it here to sign in.
      </p>

      {state.kind === "error" && (
        <div className="mt-6">
          <AuthAlert tone="error">{state.message}</AuthAlert>
        </div>
      )}
      {errorMsg && (
        <div className="mt-6">
          <AuthAlert tone="error">{errorMsg}</AuthAlert>
        </div>
      )}

      <form onSubmit={handleVerify} className="mt-8">
        
        {/* Email input if not in URL */}
        {!emailParam && (
          <div className="mb-6">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-sm text-gray-900 outline-none focus:border-colly focus:ring-2 focus:ring-colly/20"
            />
          </div>
        )}

        {/* 6 Digit Pill Boxes */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-8">
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="h-12 w-10 sm:h-14 sm:w-12 rounded-full border border-gray-300 text-center text-xl font-medium text-gray-900 outline-none transition-all focus:border-colly focus:ring-2 focus:ring-colly/20"
            />
          ))}
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={submitting || otp.some(d => !d)}
          className="w-full rounded-full h-12 text-base font-semibold"
        >
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify email"}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-gray-500">
        <Link
          href="/login?role=business"
          className="font-medium text-colly transition-colors hover:text-colly-hover"
        >
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center rounded-lg border border-gray-200 bg-surface text-sm text-gray-500">
          Verifying your email…
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}