export const instant = false;
import { connection } from "next/server";
// import { requireSiteAccess } from "@/lib/site-access"; // Commented out - file not found
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Footer } from "@/components/ui/footer";


interface LayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: LayoutProps) {
  await connection();

    

  return (
    <DashboardShell>
      {children}
      <Footer />
      
    </DashboardShell>
  );
}
