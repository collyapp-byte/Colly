import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Colly collects, uses, and protects your information under the Nigeria Data Protection Act 2023.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Last updated: October 17, 2026`}
      </p>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Colly ("we," "us," or "our") provides an AI-powered WhatsApp assistant for businesses in Nigeria. This Privacy Policy explains how we collect, use, and protect your information.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">1. INFORMATION WE COLLECT</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`- Business Information: Name, email address, phone number, and WhatsApp number.
- Customer Interactions: Messages, voice notes, and images sent to your business's WhatsApp number.
- Payment Data: We use Paystack to process payments. We do not store your full card details on our servers.
- Usage Data: How you interact with our dashboard.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">2. HOW WE USE INFORMATION</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`- To provide and maintain the Colly AI service.
- To process transactions and send billing alerts.
- To improve our AI models (all data is anonymized before training).
- To comply with legal obligations, including the Nigeria Data Protection Act (NDPA) 2023.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">3. AI PROCESSING</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Your customer messages are processed by third-party AI providers (DeepSeek, Groq, OpenRouter) to generate responses. We do not sell your data to these providers.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">4. DATA RETENTION</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`We retain your data for as long as your account is active. You can request deletion at any time.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">5. YOUR RIGHTS (NDPA 2023)</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`You have the right to access, correct, or delete your personal data. To exercise these rights, visit colly.com.ng/account/delete or contact support.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">6. CONTACT US</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`If you have questions, email us at support@colly.com.ng.`}
      </p>
    </div>
  );
}
