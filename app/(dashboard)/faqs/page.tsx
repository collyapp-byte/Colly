"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CircleAlert, LoaderCircle, Pencil, Plus, Trash } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  createdAt: string;
};

type FaqInput = {
  question: string;
  answer: string;
  category: string | null;
};

const FAQ_CATEGORIES = [
  "Delivery",
  "Payment",
  "Returns",
  "Warranty",
  "Location",
  "Hours",
  "Other",
] as const;

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; faq: Faq }
  | { kind: "delete"; faq: Faq };

const EMPTY_STATE_TEXT =
  "No FAQs yet. Add answers to common customer questions so your AI can reply automatically.";

type PresetFaq = FaqInput & { id: string };

const PRESET_FAQS: PresetFaq[] = [
  {
    id: "delivery",
    question: "Do you deliver to other states?",
    answer:
      "Yes, we deliver nationwide via waybill. Delivery fees depend on your location.",
    category: "Delivery",
  },
  {
    id: "payment",
    question: "Do you accept POS or Bank Transfer?",
    answer:
      "Yes, we accept cash, POS, and bank transfers. Payment must be confirmed before dispatch.",
    category: "Payment",
  },
  {
    id: "original",
    question: "Are your products original?",
    answer:
      "Yes, all our products are 100% original and come with a warranty.",
    category: "Warranty",
  },
  {
    id: "hours",
    question: "What are your opening hours?",
    answer: "We are open Monday to Saturday, 9am to 6pm.",
    category: "Hours",
  },
];

type FaqGroup = {
  label: string;
  faqs: Faq[];
};

/** Groups FAQs by category, with uncategorised entries in a trailing "Other". */
function groupFaqs(faqs: Faq[]): FaqGroup[] {
  const groups = new Map<string, Faq[]>();

  for (const faq of faqs) {
    if (!faq.category) continue;
    const list = groups.get(faq.category) ?? [];
    list.push(faq);
    groups.set(faq.category, list);
  }

  const result: FaqGroup[] = [...groups.entries()].map(([label, items]) => ({
    label,
    faqs: items,
  }));

  const uncategorised = faqs.filter((faq) => !faq.category);
  if (uncategorised.length > 0) {
    result.push({ label: "Other", faqs: uncategorised });
  }

  return result;
}

export default function FaqsPage() {
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [dismissedPresets, setDismissedPresets] = useState<string[]>([]);
  const [addingPresetId, setAddingPresetId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/faqs");
        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }
        const data: { faqs: Faq[] } = await res.json();
        if (active) {
          setFaqs(data.faqs);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Something went wrong");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  /** Re-fetches the list after a create / update / delete. */
  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);

  const closeModal = useCallback(() => setModal({ kind: "closed" }), []);

  async function handleCreate(values: FaqInput) {
    const res = await fetch("/api/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to create FAQ");
    }

    toast.success("FAQ added!");
    refresh();
  }

  async function handleAddPreset(preset: PresetFaq) {
    setAddingPresetId(preset.id);

    try {
      await handleCreate({
        question: preset.question,
        answer: preset.answer,
        category: preset.category,
      });
      setDismissedPresets((prev) =>
        prev.includes(preset.id) ? prev : [...prev, preset.id],
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setAddingPresetId(null);
    }
  }

  function dismissPreset(id: string) {
    setDismissedPresets((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  async function handleUpdate(id: string, values: FaqInput) {
    const res = await fetch(`/api/faqs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? "Failed to update FAQ");
    }

    toast.success("FAQ updated!");
    refresh();
  }

  async function handleDelete(faq: Faq) {
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/faqs/${faq.id}`, { method: "DELETE" });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to delete FAQ");
      }

      setModal({ kind: "closed" });
      toast.success("FAQ deleted!");
      refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
      toast.error("Something went wrong. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  function openDelete(faq: Faq) {
    setDeleteError(null);
    setModal({ kind: "delete", faq });
  }

  const loading = faqs === null && error === null;
  const groups = faqs ? groupFaqs(faqs) : [];
  const visiblePresets = PRESET_FAQS.filter(
    (preset) => !dismissedPresets.includes(preset.id),
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gray-900 sm:text-3xl">FAQs</h1>
          <p className="mt-1 text-sm text-gray-500">
            Answers to common questions. Colly uses these to reply automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModal({ kind: "create" })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Add FAQ
        </button>
      </div>

      {loading && <FaqSkeleton />}

      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="font-medium">Could not load FAQs</p>
            <p className="text-danger/80">{error}</p>
          </div>
        </div>
      )}

      {faqs && faqs.length === 0 && (
        <section className="rounded-xl border border-gray-200 bg-surface p-5 sm:p-6">
          <div className="mb-4">
            <h2 className="font-display text-lg font-semibold text-gray-900">
              Quick Start FAQ
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Add ready-made answers so your AI can start replying right away.
            </p>
          </div>

          {visiblePresets.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {visiblePresets.map((preset) => {
                const adding = addingPresetId === preset.id;
                return (
                  <article
                    key={preset.id}
                    className="flex flex-col rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <p className="font-display text-sm font-semibold text-gray-900">
                      {preset.question}
                    </p>
                    <p className="mt-1 flex-1 text-sm text-gray-600">
                      {preset.answer}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddPreset(preset)}
                        disabled={addingPresetId !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-colly px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-colly-hover disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {adding && (
                          <LoaderCircle
                            className="h-3.5 w-3.5 animate-spin"
                            aria-hidden
                          />
                        )}
                        Add to my FAQs
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissPreset(preset.id)}
                        disabled={adding}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
                      >
                        Not applicable
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-500">{EMPTY_STATE_TEXT}</p>
          )}
        </section>
      )}

      {faqs && faqs.length > 0 && (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                {group.label}
              </h2>
              <ul className="space-y-3">
                {group.faqs.map((faq) => (
                  <li
                    key={faq.id}
                    className="rounded-lg border border-gray-200 bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display font-semibold text-gray-900">
                          {faq.question}
                        </p>
                        <p className="mt-1 text-sm text-gray-700">{faq.answer}</p>
                        <span className="mt-3 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                          {faq.category ?? "Other"}
                        </span>
                      </div>
                      <ActionButtons
                        question={faq.question}
                        onEdit={() => setModal({ kind: "edit", faq })}
                        onDelete={() => openDelete(faq)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {modal.kind === "create" && (
        <FaqFormModal
          mode="create"
          onClose={closeModal}
          onSubmit={handleCreate}
        />
      )}

      {modal.kind === "edit" && (
        <FaqFormModal
          mode="edit"
          faq={modal.faq}
          onClose={closeModal}
          onSubmit={(values) => handleUpdate(modal.faq.id, values)}
        />
      )}

      {modal.kind === "delete" && (
        <Modal title="Delete FAQ" onClose={closeModal}>
          <p className="text-sm text-gray-600">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-900">
              {modal.faq.question}
            </span>
            ? This cannot be undone.
          </p>

          {deleteError && (
            <p className="mt-3 text-sm text-danger">{deleteError}</p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeModal}
              disabled={deleting}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(modal.faq)}
              disabled={deleting}
              className="inline-flex items-center gap-2 rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60"
            >
              {deleting && (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
              )}
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

type ActionButtonsProps = {
  question: string;
  onEdit: () => void;
  onDelete: () => void;
};

function ActionButtons({ question, onEdit, onDelete }: ActionButtonsProps) {
  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${question}`}
        title="Edit"
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
      >
        <Pencil className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${question}`}
        title="Delete"
        className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-red-50 hover:text-danger"
      >
        <Trash className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

type FaqFormModalProps = {
  mode: "create" | "edit";
  faq?: Faq;
  onClose: () => void;
  /** Should throw with a message when the save fails. */
  onSubmit: (values: FaqInput) => Promise<void>;
};

function FaqFormModal({ mode, faq, onClose, onSubmit }: FaqFormModalProps) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [category, setCategory] = useState<string>(
    faq?.category && (FAQ_CATEGORIES as readonly string[]).includes(faq.category)
      ? faq.category
      : "Other",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setError("Question is required.");
      return;
    }

    const trimmedAnswer = answer.trim();
    if (!trimmedAnswer) {
      setError("Answer is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        question: trimmedQuestion,
        answer: trimmedAnswer,
        category: category === "Other" ? null : category,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Modal title={mode === "create" ? "Add FAQ" : "Edit FAQ"} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="faq-question" className={LABEL_CLASS}>
            Question
          </label>
          <input
            id="faq-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="e.g. Do you deliver?"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="faq-answer" className={LABEL_CLASS}>
            Answer
          </label>
          <textarea
            id="faq-answer"
            rows={4}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="What should your AI tell customers?"
            className={INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="faq-category" className={LABEL_CLASS}>
            Category
          </label>
          <select
            id="faq-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={INPUT_CLASS}
          >
            {FAQ_CATEGORIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
            <Button type="submit" variant="primary" isLoading={saving}>
            {mode === "create" ? "Save FAQ" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function FaqSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="space-y-3 rounded-lg border border-gray-200 bg-surface p-4"
        >
          <div className="h-3.5 w-48 animate-pulse rounded bg-gray-100" />
          <div className="h-3 w-full max-w-md animate-pulse rounded bg-gray-100" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
