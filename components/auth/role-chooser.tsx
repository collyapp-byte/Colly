"use client";

/** The two audiences that share the login and signup entry points. */
export type AuthRole = "business" | "agent";

type RoleChooserProps = {
  variant: "login" | "signup";
  onSelect: (role: AuthRole) => void;
};

const OPTIONS: { role: AuthRole; title: string; description: string }[] = [
  {
    role: "business",
    title: "Business Owner",
    description: "Manage your shop, AI replies, sales",
  },
  {
    role: "agent",
    title: "Colly Agent",
    description: "Get certified, onboard businesses, earn setup fees",
  },
];

/**
 * The first step of the unified auth flow: pick whether you're a business or an
 * agent before the matching form is shown.
 */
export function RoleChooser({ variant, onSelect }: RoleChooserProps) {
  const verb = variant === "login" ? "signing in" : "signing up";

  return (
    <div className="mx-auto w-full max-w-md">
      <h1 className="font-display text-2xl text-gray-900">Welcome to Colly</h1>
      <p className="mt-1 text-sm text-gray-500">Who are you {verb} as?</p>

      <div className="mt-6 flex flex-col gap-3">
        {OPTIONS.map((option) => (
          <button
            key={option.role}
            type="button"
            onClick={() => onSelect(option.role)}
            className="group w-full rounded-lg border border-gray-200 bg-surface p-4 text-left transition-colors hover:border-colly hover:bg-colly/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-colly/40"
          >
            <div className="text-sm font-semibold text-gray-900 transition-colors group-hover:text-colly">
              {option.title}
            </div>
            <div className="mt-1 text-sm text-gray-500">{option.description}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
