import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";

// Same field styling as the product form, so the auth screens match the rest of
// the app.
const LABEL_CLASS = "mb-1 block text-sm font-medium text-gray-700";
const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition-colors focus:border-colly focus:ring-2 focus:ring-colly/20";

export const SUBMIT_BUTTON_CLASS =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-colly px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-colly-hover disabled:opacity-60";

type AuthFieldProps = {
  id: string;
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  hint?: ReactNode;
};

/** A labelled text input for the login and signup forms. */
export function AuthField({
  id,
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  minLength,
  hint,
}: AuthFieldProps) {
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        minLength={minLength}
        required
        className={INPUT_CLASS}
      />
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

/** The message block under a form: red for errors, green for notices. */
export function AuthAlert({
  tone,
  children,
}: {
  tone: "error" | "success";
  children: ReactNode;
}) {
  const Icon = tone === "error" ? CircleAlert : CircleCheck;

  const toneClass =
    tone === "error"
      ? "border-danger/30 bg-danger/5 text-danger"
      : "border-success/30 bg-success/5 text-success";

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border p-4 text-sm ${toneClass}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <p>{children}</p>
    </div>
  );
}
