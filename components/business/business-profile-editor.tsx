"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Edit2, FileText, MapPin, Phone, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const SECTION_CLASS = "surface-card p-5 sm:p-6";
const HEADING_CLASS = "font-display text-base tracking-wide text-main";
const LABEL_CLASS = "mb-1 block text-sm font-medium text-main";
const INPUT_CLASS =
  "w-full rounded-xl border border-card-ring px-3 py-2 text-sm text-main outline-none transition-all duration-250 focus:border-colly focus:ring-2 focus:ring-colly/20";

type ToneValue = "formal" | "friendly";

const TONE_LABELS: Record<ToneValue, string> = {
  formal: "Formal & Professional",
  friendly: "Friendly & Casual",
};

type BusinessProfileEditorProps = {
  id: string;
  name: string;
  phone: string;
  businessHours: string | null;
  address: string | null;
  description: string | null;
  tone: string;
  isOwner: boolean;
};

type ProfileForm = {
  name: string;
  phone: string;
  businessHours: string;
  address: string;
  description: string;
};

function toneLabel(tone: unknown): string {
  const value: ToneValue | undefined =
    typeof tone === "string" && (tone === "formal" || tone === "friendly")
      ? tone
      : undefined;
  return value ? TONE_LABELS[value] : String(tone || "Friendly & Casual");
}

export function BusinessProfileEditor({
  id,
  name,
  phone,
  businessHours,
  address,
  description,
  tone,
  isOwner,
}: BusinessProfileEditorProps) {
  const router = useRouter();
  const [view, setView] = useState<"view" | "edit">("view");
  const [form, setForm] = useState<ProfileForm>({
    name,
    phone,
    businessHours: businessHours ?? "",
    address: address ?? "",
    description: description ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function resetForm() {
    setForm({
      name,
      phone,
      businessHours: businessHours ?? "",
      address: address ?? "",
      description: description ?? "",
    });
    setError(null);
  }

  function update<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    if (!trimmedName) {
      setError("Business name is required.");
      return;
    }
    if (!trimmedPhone) {
      setError("Phone number is required.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName || null,
          phone: trimmedPhone || null,
          businessHours: form.businessHours.trim() || null,
          address: form.address.trim() || null,
          description: form.description.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }

      toast.success("Business profile saved.");
      resetForm();
      setView("view");
      // Refresh so /business (and this page) show the updated Prisma data.
      router.refresh();
    } catch (err) {
      setSaving(false);
      const message =
        err instanceof Error ? err.message : "Could not save the profile.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <section className={`${SECTION_CLASS} space-y-5`}>
      {view === "view" ? (
        <ViewMode />
      ) : (
        <EditMode />
      )}
    </section>
  );

  // ---- View mode -----------------------------------------------------------

function ViewMode() {
    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className={HEADING_CLASS}>Business Profile</h2>
            <p className="mt-1 text-sm text-muted">{name}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/business"
              className="text-xs font-semibold text-colly hover:underline"
            >
              Back to Business Hub
            </Link>
            {isOwner && (
              <Button type="button" size="sm" onClick={() => setView("edit")}>
                <Edit2 className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ProfileField
            label="Business Name"
            value={name}
            icon={<FileText className="h-5 w-5 text-colly" />}
          />
          <ProfileField
            label="Description"
            value={
              description || (
                <span className="text-muted italic">
                  No description yet - tell Colly what your business sells so
                  the AI can answer customers.
                </span>
              )
            }
            icon={<FileText className="h-5 w-5 text-muted" />}
          />
          <ProfileField
            label="Phone"
            value={phone}
            icon={<Phone className="h-5 w-5 text-muted" />}
          />
          <ProfileField
            label="Operating Hours"
            value={
              businessHours || (
                <span className="text-muted">Not set</span>
              )
            }
            icon={<Clock className="h-5 w-5 text-muted" />}
          />
          <ProfileField
            label="Address"
            value={
              address || (
                <span className="text-muted">Not set</span>
              )
            }
            icon={<MapPin className="h-5 w-5 text-muted" />}
          />
          <ProfileField
            label="AI Tone"
            value={toneLabel(tone)}
            icon={<FileText className="h-5 w-5 text-muted" />}
          />
        </div>
      </>
    );
  }

  // ---- Edit mode -----------------------------------------------------------

  function EditMode() {
    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <h2 className={HEADING_CLASS}>Edit Profile</h2>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              resetForm();
              setView("view");
            }}
          >
            Cancel
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500 bg-red-50/50 p-3 text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <ProfileInput
            label="Business Name"
            id={`business-profile-${id}-name`}
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            placeholder="e.g. ABC Electronics"
            disabled={saving}
            required
          />
          <ProfileInput
            label="Phone Number"
            id={`business-profile-${id}-phone`}
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            type="tel"
            placeholder="e.g. 08012345678"
            disabled={saving}
            required
          />
          <ProfileInput
            label="Address"
            id={`business-profile-${id}-address`}
            value={form.address}
            onChange={(event) => update("address", event.target.value)}
            placeholder="e.g. 12 Broad Street, Lagos Island"
            disabled={saving}
          />
          <ProfileInput
            label="Operating Hours"
            id={`business-profile-${id}-business-hours`}
            value={form.businessHours}
            onChange={(event) => update("businessHours", event.target.value)}
            placeholder="e.g. Mon-Fri 9am-6pm"
            disabled={saving}
          />
          <ProfileTextarea
            label="Description"
            id={`business-profile-${id}-description`}
            value={form.description}
            onChange={(event) => update("description", event.target.value)}
            placeholder="What your business sells - this is given to the AI as context."
            disabled={saving}
          />

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted">
              Saving updates your business profile across Colly immediately.
            </p>
            <Button
              type="submit"
              variant="primary"
              isLoading={saving}
              disabled={!isOwner}
            >
              {saving ? (
                <Save className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        </form>

        {!isOwner && (
          <p className="mt-3 text-xs text-muted">
            Profile edits are managed by the business owner.
          </p>
        )}
      </>
    );
  }

  function ProfileField({
    label,
    value,
    icon,
  }: {
    label: string;
    value: string | ReactNode;
    icon: ReactNode;
  }) {
    return (
      <div
        className="self-start rounded-xl border border-card-ring bg-surface-muted/40 p-3 flex items-start gap-3"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-card-ring text-muted">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
            {label}
          </p>
          <p className="mt-0.5 font-medium text-main">{value}</p>
        </div>
      </div>
    );
  }

  function ProfileInput({
    label,
    id: fieldId,
    value,
    onChange,
    placeholder,
    disabled,
    required,
    type = "text",
  }: {
    label: string;
    id: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    type?: string;
  }) {
    return (
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor={fieldId}>
          {label}{required ? " *" : ""}
        </label>
        <input
          id={fieldId}
          type={type}
          className={INPUT_CLASS}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />
      </div>
    );
  }

  function ProfileTextarea({
    label,
    id: fieldId,
    value,
    onChange,
    placeholder,
    disabled,
  }: {
    label: string;
    id: string;
    value: string;
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    placeholder?: string;
    disabled?: boolean;
  }) {
    return (
      <div className="space-y-1">
        <label className={LABEL_CLASS} htmlFor={fieldId}>{label}</label>
        <textarea
          id={fieldId}
          className={`${INPUT_CLASS} min-h-[120px] resize-y`}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    );
  }
}

