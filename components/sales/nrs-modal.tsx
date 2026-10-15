"use client";

import { useState, type FormEvent } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";

const REGISTRATION_URL = "https://einvoice.nrs.gov.ng";

type NrsModalProps = {
  onClose: () => void;
  /** Called after anything that changes the business's NRS state, so the page
   *  can re-fetch and rebuild the banner. */
  onSaved: () => void;
};

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

export function NrsModal({ onClose, onSaved }: NrsModalProps) {
  const [taxId, setTaxId] = useState("");
  const [saving, setSaving] = useState<
    "taxId" | "accountant" | "remind" | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/business/nrs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function handleSaveTaxId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = taxId.trim();

    if (!value) {
      setError("Enter your NRS Tax ID first.");
      return;
    }

    setSaving("taxId");
    setError(null);

    try {
      const ok = await patch({ nrsTaxId: value });
      if (!ok) {
        setError("Could not save your Tax ID. Please try again.");
        setSaving(null);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Could not save your Tax ID. Please try again.");
      setSaving(null);
    }
  }

  async function handleAccountant() {
    setSaving("accountant");
    setError(null);

    try {
      const ok = await patch({ nrsExemptReason: "handled_by_accountant" });
      if (!ok) {
        setError("Could not save that. Please try again.");
        setSaving(null);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Could not save that. Please try again.");
      setSaving(null);
    }
  }

  async function handleRemindLater() {
    setSaving("remind");
    setError(null);

    try {
      const ok = await patch({ dismissed: true });
      if (!ok) {
        setError("Could not dismiss right now. Please try again.");
        setSaving(null);
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Could not dismiss right now. Please try again.");
      setSaving(null);
    }
  }

  const busy = saving !== null;

  return (
    <Modal title="Get NRS-Compliant" onClose={onClose}>
      <div className="space-y-4">
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            From January 2028, every Nigerian business must send every sale to
            the NRS in real time.
          </p>
          <p>
            Your CAC number is your Tax ID — you don&apos;t need to apply
            separately.
          </p>
          <p>To get ready:</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>Register at einvoice.nrs.gov.ng</li>
            <li>Copy your NRS Tax ID</li>
            <li>Paste it below</li>
          </ol>
        </div>

        <form onSubmit={handleSaveTaxId}>
          <label htmlFor="nrs-tax-id" className={LABEL_CLASS}>
            NRS Tax ID
          </label>
          <input
            id="nrs-tax-id"
            type="text"
            value={taxId}
            onChange={(event) => setTaxId(event.target.value)}
            placeholder="e.g. 12345678-0001"
            disabled={busy}
            className={INPUT_CLASS}
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60"
          >
            {saving === "taxId" && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            )}
            Save Tax ID
          </button>
        </form>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() =>
              window.open(REGISTRATION_URL, "_blank", "noopener,noreferrer")
            }
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open Registration Portal
          </button>
          <button
            type="button"
            onClick={handleAccountant}
            disabled={busy}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60"
          >
            {saving === "accountant" && (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
            )}
            My accountant handles this
          </button>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <button
          type="button"
          onClick={handleRemindLater}
          disabled={busy}
          className="block text-center text-sm text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-60"
        >
          Remind me later
        </button>
      </div>
    </Modal>
  );
}