import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How Colly collects, uses and protects business, customer and agent information under the Nigeria Data Protection Act 2023.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Last updated: October 26, 2026`}
      </p>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Colly ("we," "us," or "our") provides an AI assistant that helps Nigerian businesses answer customer messages on Telegram, Discord, Web Chat and — through a manual onboarding waitlist — WhatsApp. This Privacy Policy explains what we collect, why we collect it, who processes it, and the rights you have under the Nigeria Data Protection Act (NDPA) 2023.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">1. INFORMATION WE COLLECT</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Business account data: business name, contact name, email address, phone number, WhatsApp number, and anything you add to your profile (description, opening hours, address, payment instructions, tone).

Catalogue data: products (names, prices, floor prices, stock, descriptions, images) that you add by hand or import from a CSV file, and FAQs you write yourself.

Customer conversations: messages, voice notes and images that customers send to your connected channels, plus the replies our AI or your team send back. A customer record may include a name, a channel identifier (for example a Telegram chat id or a website session id) and tags you apply.

Billing data: plan, credits, invoices and transaction references. Card payments are processed by Paystack; we never store your full card details.

Agent data (if you join our partner programme): name, phone number, state, certification and quiz results, referral records, commission balance and the bank details you provide for payouts.

Usage and technical data: dashboard activity, AI usage counts, and — only if analytics is switched on for your account — anonymised page views.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">2. HOW WE USE INFORMATION</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`- To provide the service: store your catalogue, generate AI replies, keep your inbox and CRM, and produce reports.
- To bill you: process plan and credit payments, issue receipts and send low-credit alerts.
- To keep the service safe: detect abuse, prevent credit abuse and debug failures.
- To meet legal obligations, including the NDPA 2023 and tax/accounting duties.

We do not sell personal data, and we do not use your customer conversations to train our own models.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">3. AI PROCESSING</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`When a customer messages your business, the conversation (including the relevant catalogue entries) is sent to our AI provider, DeepSeek, to generate a reply. Product text is also sent to Jina AI to create search embeddings, so the AI can find the right product. These providers process the data only to return a result for us. Because they operate outside Nigeria, this involves a cross-border transfer of data; we rely on your instructions as the business operating the assistant and on the providers' contractual data-processing terms.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">4. WHO WE SHARE DATA WITH</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`- Supabase — database, file storage and authentication.
- DeepSeek — AI reply generation.
- Jina AI — product search embeddings.
- Paystack — card payments, subscriptions and agent payouts.
- Telegram, Discord and Meta — delivering messages on the channel you connect. WhatsApp is only activated when your business is onboarded from the waitlist.
- Umami — optional, cookieless page analytics (only when enabled).
- Microsoft Clarity — optional, session recordings and heatmaps (only when enabled).
- Professional advisers or authorities where the law requires it.

Each processor is bound to use the data only for the service it provides to us.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">5. DATA RETENTION</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`We keep your account and conversation data while your account is active so your inbox, reports and AI history keep working. When you close your account we delete or anonymise the data within a reasonable period, except records we must keep for accounting, fraud prevention or legal claims. You can request deletion at any time (see section 7).`}
      </p>

      <h2 className="text-2xl font-bold mb-6">6. SECURITY</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Access is scoped per business: every query is limited to your business id, and dashboards require an authenticated session. Channel tokens and Paystack secrets are stored server-side and never sent to the browser. No system is perfectly secure, so tell us immediately if you suspect unauthorised access.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">7. YOUR RIGHTS (NDPA 2023)</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`You have the right to access, correct, delete, restrict or object to the processing of your personal data, and to request a copy in a portable format. Email support@colly.com.ng from the address on the account and we will respond within the period allowed by the NDPA. If you are a customer of a business using Colly, contact that business first — they control the conversation data — and we will assist them.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">8. CHILDREN</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Colly is a business tool and is not intended for use by anyone under 18. We do not knowingly collect data from children.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">9. CHANGES TO THIS POLICY</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`We may update this policy as the product changes. Material changes will be announced in the dashboard or by email before they take effect, and the date at the top will always show the current version.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">10. CONTACT US</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Questions, requests or complaints: support@colly.com.ng.`}
      </p>
    </div>
  );
}
