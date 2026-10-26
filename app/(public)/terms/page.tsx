import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Terms of Service",
  description:
    "The terms governing your use of Colly, the multi-channel AI assistant for small businesses.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Terms of Service</h1>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Last updated: October 26, 2026`}
      </p>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Welcome to Colly. These Terms govern your use of the Colly AI assistant and dashboard. By creating an account or using the service you agree to them. If you use Colly for a business, you confirm you are authorised to act for that business.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">1. THE SERVICE</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Colly connects an AI assistant to the messaging channels you enable — Telegram, Discord and Web Chat today, and WhatsApp once your business is onboarded from the waitlist. The assistant answers from the catalogue, FAQs and contact details you provide.

The service is provided "as is". AI output can be incomplete or wrong, channels can go down, and scheduled jobs can be delayed. You are responsible for monitoring conversations and taking over when a customer needs a human.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">2. ACCOUNTS</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`You must be at least 18 and provide accurate business details. You are responsible for keeping your login secure and for everything done under your account. Tell us immediately if you believe your account or a channel token has been compromised.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">3. PLANS, CREDITS AND BILLING</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`- Plans (Free, Green, Blue, Black) are billed monthly or yearly in Naira through Paystack.
- Every account starts on the permanent Free plan: 80 credits every 30 days, no card required.
- AI replies cost credits (5 on Telegram, Discord and Web Chat; 80 on WhatsApp). Manual replies are free.
- Plan credits are a monthly allowance and do not roll over. Top-up credits were paid for and never expire.
- If your balance cannot cover a reply, the AI pauses until you top up or upgrade; your inbox keeps working.
- You can cancel at any time from Billing. Access continues until the end of the period you already paid for, then the account moves to Free.
- Fees already paid are non-refundable except where the law requires it or we agree in writing. Credits consumed are not refundable.
- Prices may change; we will give notice before a change applies to your next renewal.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">4. ACCEPTABLE USE</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`You agree NOT to use Colly to:
- send spam, unsolicited marketing or bulk broadcasts;
- break the rules of the channel you connect, including Telegram's, Discord's and Meta's platform and commerce policies;
- mislead customers about prices, availability or who they are talking to;
- upload unlawful content, malware or another business's data;
- resell, sublicense or reverse engineer the service outside a signed agent agreement;
- attempt to access another business's data or overload the platform.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">5. AI DISCLAIMER</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`The AI generates replies from the data you supply. We do not guarantee that every reply is accurate, complete or suitable for a particular sale. The business owner remains responsible for the catalogue, the prices quoted to customers, and for handing over to a human when needed. Do not rely on Colly alone for legal, medical, financial or safety advice.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">6. AGENT PROGRAMME</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`If you register as a Colly agent: certification requires passing the final exam; commission is 15% of each subscription charge from a referred business for the first 12 months; payouts require bank details and a minimum balance of ₦5,000; and you must never collect a customer's subscription payment into a personal account. We may suspend an agent account for misrepresentation, fraudulent referrals or misuse of customer data.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">7. SUSPENSION AND TERMINATION</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`You may stop using Colly and close your account at any time. We may suspend or terminate an account that breaches these Terms, abuses credits, fails to pay, or creates risk for other customers. Where it is reasonable, we will warn you first and let you export your catalogue.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">8. LIMITATION OF LIABILITY</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`To the maximum extent permitted by Nigerian law, Colly is not liable for indirect, incidental or consequential loss, lost profit or lost sales, or for the acts of third-party platforms and providers. Our total liability for any claim is limited to the fees you paid us in the three months before the event giving rise to it.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">9. CHANGES AND GOVERNING LAW</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`We may update these Terms; material changes will be announced in the dashboard or by email before they take effect. These Terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have jurisdiction.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">10. CONTACT</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Questions about these Terms: support@colly.com.ng.`}
      </p>
    </div>
  );
}
