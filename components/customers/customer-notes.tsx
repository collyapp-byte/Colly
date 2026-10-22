"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateCustomerDetails } from "@/app/api/customers/actions";

const TEXTAREA_CLASS =
  "w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 disabled:bg-gray-50";

export function CustomerNotes({
  customerId,
  businessId,
  initialNotes,
}: {
  customerId: string;
  businessId: string;
  initialNotes: string | null;
}) {
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);

    const result = await updateCustomerDetails(customerId, businessId, {
      notes,
    });

    setSaving(false);

    if (result.ok) {
      setNotes(result.customer.notes ?? "");
      toast.success("Notes saved");
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        rows={4}
        placeholder="Anything your team should know about this customer?"
        disabled={saving}
        aria-label="Customer notes"
        className={TEXTAREA_CLASS}
      />
      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={save} isLoading={saving} size="sm">
          Save Notes
        </Button>
      </div>
    </div>
  );
}
