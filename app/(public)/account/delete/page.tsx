import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Deletion",
  description:
    "Request the permanent deletion of your Colly account and all associated data.",
};

export default function AccountDeletePage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <h1 className="text-2xl font-bold mb-6">Account Deletion</h1>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Last updated: October 17, 2026`}
      </p>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`At Colly, we respect your privacy. You can request the permanent deletion of your account and all associated data at any time.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">
        WHAT HAPPENS WHEN YOU DELETE YOUR ACCOUNT:
      </h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`- Your business profile, dashboard access, and AI assistant will be permanently disabled.
- All conversations, customer data, product catalogs, and sales records will be permanently erased from our active databases within 30 days.
- Your subscription will be cancelled immediately via Paystack.`}
      </p>

      <h2 className="text-2xl font-bold mb-6">HOW TO DELETE:</h2>
      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Send an email to support@colly.com.ng with the subject line "Account Deletion Request" from the email address associated with your Colly account, OR use the button below.`}
      </p>

      <p className="text-gray-600 mb-4 whitespace-pre-wrap">
        {`Please note: Once deleted, this data cannot be recovered.`}
      </p>

      <a
        href="mailto:support@colly.com.ng?subject=Account%20Deletion%20Request"
        className="inline-flex items-center justify-center rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
      >
        Request Account Deletion
      </a>
    </div>
  );
}
