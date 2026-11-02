import { connection } from "next/server";
import { requireAuth } from "@/lib/auth";
import { requireSiteAccess } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Footer } from "@/components/ui/footer";
import { OnboardingWizard } from "@/components/onboarding";

interface LayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: LayoutProps) {
  await connection();

  const user = await requireAuth();
  await requireSiteAccess(user.businessId);

  return (
    <DashboardShell>
      {children}
      <Footer />
      <OnboardingWizard onClose={() => {}} onComplete={() => {}} />
    </DashboardShell>
  );
}
