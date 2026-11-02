import { connection } from "../../lib/db";
import { requireAuth } from "@/lib/auth";
import { requireSiteAccess } from "../../lib/site-access";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { Footer } from "../../components/footer";
import { OnboardingWizard } from "@/components/onboarding";

interface LayoutProps {
  children: React.ReactNode;
}

export default async function DashboardLayout({ children }: LayoutProps) {
  await connection();

  const user = await requireAuth();
  await requireSiteAccess(user.businessId);

  const business = await prisma.business.findUnique({
    where: { id: user.businessId },
    select: {
      telegramBotToken: true,
      onboardingCompleted: true,
      products: { take: 1, select: { id: true } },
    },
  });

  const needsOnboarding = business && (!business.onboardingCompleted || !business.products.length);

  return (
    <DashboardShell>
      {children}
      <Footer />
      {needsOnboarding && <OnboardingWizard onClose={() => {}} onComplete={() => {}} />}
    </DashboardShell>
  );
}
