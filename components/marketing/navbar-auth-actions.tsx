"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * The marketing navbar's right-hand side. A signed-in owner should see a way
 * into their dashboard, everyone else the Sign In / Get Started pair -- so the
 * session is checked once on the client and the buttons swap. The signed-out
 * pair renders first: almost every visitor to the homepage is signed out, and
 * that keeps the landing page statically prerenderable.
 */
export function NavbarAuthActions() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    fetch("/api/business")
      .then((res) => {
        if (active && res.ok) setSignedIn(true);
      })
      .catch(() => {
        // Signed out (or the endpoint is down); keep the default buttons.
      });

    return () => {
      active = false;
    };
  }, []);

  if (signedIn) {
    return (
      <Link
        href="/dashboard"
        className="rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
      >
        Go to Dashboard
      </Link>
    );
  }

  return (
    <>
      <Link
        href="/login"
        className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
      >
        Sign In
      </Link>
      <Link
        href="/signup"
        className="rounded-lg bg-[#FF6600] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#E65C00]"
      >
        Get Started
      </Link>
    </>
  );
}
