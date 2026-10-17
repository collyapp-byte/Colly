import Link from "next/link";

/**
 * Global site footer with the legal links and copyright line. Rendered at the
 * bottom of the public, auth and dashboard shells.
 */
export function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-gray-100 px-4 py-6 text-xs text-gray-500">
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
    </footer>
  );
}
