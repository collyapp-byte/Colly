"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownCircle, CreditCard, Info, Loader2 } from "lucide-react";
import { formatNaira } from "@/lib/format";

type Bank = {
  id: number;
  name: string;
  code: string;
};

type BankDetails = {
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankCode: string | null;
  paystackRecipientCode: string | null;
};

type WalletData = {
  commissionBalanceNaira: number;
  bankDetails: BankDetails;
  banks: Bank[];
  payouts: Payout[];
};

type Payout = {
  id: string;
  amountNaira: number;
  status: string;
  reference: string;
  createdAt: string;
};

export default function AgentWalletPage() {
  const router = useRouter();
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [payoutting, setPayoutting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [payoutSuccess, setPayoutSuccess] = useState<string | null>(null);

  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/agents/bank-details");
        if (res.status === 401) {
          router.push("/agents/login");
          return;
        }
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error ?? "Failed to load wallet");
        setData(payload as WalletData);
        const bd = payload.bankDetails;
        if (bd?.bankCode) setBankCode(bd.bankCode);
        if (bd?.bankAccountNumber) setAccountNumber(bd.bankAccountNumber);
        if (bd?.bankAccountName) setAccountName(bd.bankAccountName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  async function handleSaveBankDetails(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/agents/bank-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankCode,
          bankAccountNumber: accountNumber,
          bankAccountName: accountName,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to save");
      setData((prev) =>
        prev
          ? {
              ...prev,
              bankDetails: {
                bankAccountName: accountName,
                bankAccountNumber: accountNumber,
                bankCode,
                paystackRecipientCode: payload.recipientCode,
              },
            }
          : prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayout() {
    setPayoutting(true);
    setPayoutError(null);
    setPayoutSuccess(null);
    try {
      const res = await fetch("/api/agents/payouts/request", {
        method: "POST",
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Failed to request payout");
      setPayoutSuccess(`Payout of ₦${payload.amountNaira.toLocaleString()} requested`);
      setData((prev) =>
        prev
          ? {
              ...prev,
              commissionBalanceNaira: prev.commissionBalanceNaira - payload.amountNaira,
              payouts: [
                {
                  id: payload.reference,
                  amountNaira: payload.amountNaira,
                  status: "success",
                  reference: payload.reference,
                  createdAt: new Date().toISOString(),
                },
                ...(prev.payouts ?? []),
              ],
            }
          : prev,
      );
    } catch (err) {
      setPayoutError(err instanceof Error ? err.message : "Failed to request payout");
    } finally {
      setPayoutting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const hasBankDetails = Boolean(data?.bankDetails?.paystackRecipientCode);
  const minPayout = 5000;
  const canPayout = (data?.commissionBalanceNaira ?? 0) >= minPayout && hasBankDetails;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gray-900">Wallet</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track your commissions and withdraw to your bank account.
        </p>
      </div>

      {/* Balance */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Available commission balance</p>
            <p className="mt-2 font-display text-3xl text-gray-900">
              {formatNaira(data?.commissionBalanceNaira ?? 0)}
            </p>
            <p className="mt-2 flex items-center gap-1 text-xs text-gray-500">
              <Info className="h-3.5 w-3.5" />
              Minimum payout: {formatNaira(minPayout)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              type="button"
              onClick={handlePayout}
              disabled={!canPayout || payoutting}
              className="inline-flex items-center gap-2 rounded-lg bg-colly px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {payoutting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowDownCircle className="h-4 w-4" />
              )}
              Request payout
            </button>
          </div>
        </div>
        {payoutError && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {payoutError}
          </div>
        )}
        {payoutSuccess && (
          <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {payoutSuccess}
          </div>
        )}
      </section>

      {/* Bank details */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h2 className="text-sm font-medium text-gray-900">Bank details</h2>
        </div>

        {!hasBankDetails ? (
          <p className="mb-4 text-sm text-gray-500">
            Add your bank details to receive payouts.
          </p>
        ) : (
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500">Account name</p>
              <p className="text-sm text-gray-900">{data?.bankDetails.bankAccountName}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Account number</p>
              <p className="text-sm text-gray-900">{data?.bankDetails.bankAccountNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Bank</p>
              <p className="text-sm text-gray-900">
                {data?.banks.find((b) => b.code === data.bankDetails.bankCode)?.name ?? data?.bankDetails.bankCode}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Recipient code</p>
              <p className="text-xs font-mono text-gray-500">
                {data?.bankDetails.paystackRecipientCode}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveBankDetails} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="bank" className="block text-xs font-medium text-gray-700">
                Bank
              </label>
              <select
                id="bank"
                required
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Select bank</option>
                {data?.banks.map((bank) => (
                  <option key={bank.id} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="accountNumber" className="block text-xs font-medium text-gray-700">
                Account number
              </label>
              <input
                id="accountNumber"
                required
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                maxLength={10}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                placeholder="1234567890"
              />
            </div>
          </div>
          <div>
            <label htmlFor="accountName" className="block text-xs font-medium text-gray-700">
              Account name
            </label>
            <input
              id="accountName"
              required
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="John Doe"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {hasBankDetails ? "Update bank details" : "Save bank details"}
            </button>
          </div>
        </form>
      </section>

      {/* Payout history */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-medium text-gray-900">Payout history</h2>
        {data?.payouts && data.payouts.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Reference</th>
                </tr>
              </thead>
              <tbody>
                {data.payouts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2.5 pr-4 text-gray-600">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-900">
                      {formatNaira(p.amountNaira)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 capitalize">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 font-mono text-xs text-gray-500">{p.reference}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-500">No payouts yet.</p>
        )}
      </section>
    </div>
  );
}
