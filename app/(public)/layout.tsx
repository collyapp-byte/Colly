import type { ReactNode } from "react";
import { Footer } from "@/components/ui/footer";

/**
 * Layout for the always-public pages (legal pages, account deletion). No
 * session is required, so this is just a page column with the global footer.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
