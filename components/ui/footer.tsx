import Link from "next/link";

/**
 * Global site footer with the legal links and copyright line. Rendered at the
 * bottom of the public, auth and dashboard shells.
 */
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-gray-100 px-4 py-6 text-xs text-gray-500">
      <Link href="/pricing" className="transition-colors hover:text-gray-700">
        Pricing
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/academy" className="transition-colors hover:text-gray-700">
        Agent Academy
      </Link>
      <span aria-hidden="true">·</span>
      <Link
        href="/find-an-agent"
        className="transition-colors hover:text-gray-700"
      >
        Find an Agent
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/privacy" className="transition-colors hover:text-gray-700">
        Privacy Policy
      </Link>
      <span aria-hidden="true">·</span>
      <Link href="/terms" className="transition-colors hover:text-gray-700">
        Terms of Service
      </Link>
      <span aria-hidden="true">·</span>
      <Link
        href="/account/delete"
        className="transition-colors hover:text-gray-700"
      >
        Delete Account
      </Link>
      <span aria-hidden="true">·</span>
      <p>© 2026 Colly. All rights reserved.</p>
      {/* Entity declaration beside the copyright: every page carrying the
          footer states what Colly is, and which namesakes it is not. */}
      <p className="w-full text-center leading-relaxed">
        Colly AI is a Nigerian software company building AI sales assistants for
        SMEs. We are not affiliated with any other businesses or individuals
        using the name Colly.
      </p>
    </footer>
  );
}
