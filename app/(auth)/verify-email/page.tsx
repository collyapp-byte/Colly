"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AuthAlert } from "@/components/auth/auth-form";
import { Button } from "@/components/ui/button";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get("email") ?? "";
  
  const [state, setState] = useState<"checking" | "otp" | "verified" | "error">("checking");
  const [email, setEmail] = useState(emailParam);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  
  // OTP State
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const started = useRef(false);

  // Resend State
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function verifyLink() {
      const linkCode = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      
      if (searchParams.get("error")) {
        setState("error");
        setErrorMsg("This verification link is invalid or has expired.");
        return;
      }

      if (!linkCode && !tokenHash) {
        setState("otp");
        return;
      }

      try {
        const supabase = createClient();
        if (linkCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(linkCode);
          if (error) { setState("error"); setErrorMsg("Link expired."); return; }
          setState("verified");
          return;
        }
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type: "signup", token_hash: tokenHash });
          if (error) { setState("error"); setErrorMsg("Link expired."); return; }
          setState("verified");
        }
      } catch {
        setState("error"); setErrorMsg("Something went wrong.");
      }
    }
    void verifyLink();
  }, [searchParams]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (state === "otp") {
      inputRefs.current[0]?.focus();
    }
  }, [state]);

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
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newOtp = [...otp];
      for (let i = 0; i < pasted.length; i++) newOtp[i] = pasted[i];
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

  async function handleResend() {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Please enter your email address first.");
      return;
    }

    setResending(true);
    setErrorMsg("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: trimmedEmail,
      });

      if (error) {
        toast.error(error.message || "Failed to resend code.");
        return;
      }

      toast.success("A new 6-digit code has been sent to your email!");
      setResendCooldown(60); // Start 60 second cooldown
    } catch {
      toast.error("Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (state === "checking") {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">Verifying...</div>;
  }

  if (state === "verified") {
    return (
      <div className="rounded-lg border border-gray-200 bg-surface p-6 sm:p-8 text-center">
        <h1 className="font-display text-2xl text-gray-900 mb-4">Email Verified!</h1>
        <Link href="/dashboard">
          <Button variant="primary" className="w-full">Go to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-8 sm:p-12 max-w-md mx-auto w-full shadow-sm">
      {/* Replaced broken Lottie with a static SVG icon */}
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-colly/10 mb-6">
        <Mail className="h-10 w-10 text-colly" />
      </div>

      <h1 className="font-display text-2xl text-gray-900 text-center">Check verification code</h1>
      <p className="mt-2 text-sm text-gray-500 text-center">
        We&apos;ve sent a special code to your email.<br />Type it here to sign in.
      </p>

      {state === "error" && (
        <div className="mt-6"><AuthAlert tone="error">{errorMsg}</AuthAlert></div>
      )}
      {errorMsg && state !== "error" && (
        <div className="mt-6"><AuthAlert tone="error">{errorMsg}</AuthAlert></div>
      )}

      <form onSubmit={handleVerify} className="mt-8">
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

        <div className="flex justify-center gap-2 sm:gap-3 mb-6">
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

        <Button type="submit" variant="primary" disabled={submitting || otp.some(d => !d)} className="w-full rounded-full h-12 text-base font-semibold">
          {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify email"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-500">
        Didn&apos;t receive a code?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || resendCooldown > 0}
          className="font-semibold text-colly hover:underline disabled:opacity-50 disabled:no-underline"
        >
          {resending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend Code"}
        </button>
      </div>

      <p className="mt-8 text-center text-sm text-gray-500">
        <Link href="/login?role=business" className="font-medium text-colly hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-colly" /></div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}