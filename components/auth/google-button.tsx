"use client";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { toast } from "sonner";

export function GoogleButton({
  label = "Continue with Google",
  redirectTo = "/auth/callback",
}: {
  label?: string;
  redirectTo?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${redirectTo}`,
      },
    });
    if (error) {
      toast.error(error.message);
      setIsLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
      onClick={handleLogin}
      isLoading={isLoading}
    >
      <img
        src="/google.svg"
        alt=""
        className="h-5 w-5 shrink-0 object-contain"
      />
      {label}
    </Button>
  );
}
