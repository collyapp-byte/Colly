"use client";

import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { updateCustomerDetails } from "@/app/api/customers/actions";

const INPUT_CLASS =
  "w-full rounded-lg border border-card-border bg-card-surface px-3 py-1.5 text-sm text-main outline-none transition-all duration-250 placeholder:text-muted focus:border-[#FF6600] focus:ring-2 focus:ring-[#FF6600]/20 disabled:bg-surface-muted";

export function CustomerTags({
  customerId,
  businessId,
  initialTags,
}: {
  customerId: string;
  businessId: string;
  initialTags: string[];
}) {
  const [tags, setTags] = useState(initialTags);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(next: string[]) {
    const previous = tags;
    setTags(next);
    setSaving(true);

    const result = await updateCustomerDetails(customerId, businessId, {
      tags: next,
    });

    setSaving(false);

    if (result.ok) {
      setTags(result.customer.tags);
      toast.success("Tags updated");
    } else {
      setTags(previous);
      toast.error(result.error);
    }
  }

  function addTag() {
    if (saving) return;

    const tag = draft.trim();
    if (!tag) return;

    if (tags.some((existing) => existing.toLowerCase() === tag.toLowerCase())) {
      setDraft("");
      toast.error("That tag is already added.");
      return;
    }

    setDraft("");
    void save([...tags, tag]);
  }

  function removeTag(tag: string) {
    if (saving) return;
    void save(tags.filter((existing) => existing !== tag));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Tags
        </span>

        {tags.length === 0 && (
          <span className="text-sm text-muted">No tags yet</span>
        )}

        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-colly-tint py-1 pl-2.5 pr-1.5 text-xs font-semibold text-colly"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              disabled={saving}
              aria-label={`Remove ${tag} tag`}
              className="-mx-2 -my-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-all duration-250 hover:bg-[#FF6600]/15 disabled:opacity-50"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}

        {saving && (
          <Loader2
            className="h-3.5 w-3.5 animate-spin text-muted"
            aria-label="Saving tags"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2 sm:max-w-sm">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag();
            }
          }}
          placeholder="Add a tag (e.g. VIP)"
          disabled={saving}
          aria-label="New tag"
          className={INPUT_CLASS}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={addTag}
          disabled={saving || !draft.trim()}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Add
        </Button>
      </div>
    </div>
  );
}
