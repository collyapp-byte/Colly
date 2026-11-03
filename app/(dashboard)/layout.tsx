export const instant = false;
import { connection } from "next/server";
import { requireAuth } from "@/lib/auth";
// import { requireSiteAccess } from "@/lib/site-access"; // Commented out - file not found
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Footer } from "@/components/ui/footer";


interface LayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: LayoutProps) {
  await connection();

  const user = await requireAuth();
  

  return (
    <DashboardShell>
      {children}
      <Footer />
      
    </DashboardShell>
  );
}
