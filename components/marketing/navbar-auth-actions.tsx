"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function NavbarAuthActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/business")
      .then((res) => {
        if (active && res.ok) setSignedIn(true);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (signedIn) {
    return (
      <Link
        href="/dashboard"
        className="hidden md:inline-flex rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
      >
        Go to Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="hidden md:inline-flex text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        Sign In
      </Link>
      <Link
        href="/signup"
        className="hidden md:inline-flex rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00] md:px-6 md:py-2.5"
      >
        Get Started
      </Link>
    </>
  );
}