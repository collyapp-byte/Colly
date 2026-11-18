import * as React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  variant?: "primary" | "secondary" | "danger";
  /** Legacy alias of `isLoading`, kept so existing call sites keep working. */
  loading?: boolean;
  /** Legacy size prop, kept so existing call sites keep working. */
  size?: "sm" | "md";
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = "",
      children,
      isLoading,
      loading,
      disabled,
      variant = "primary",
      size = "md",
      ...props
    },
    ref,
  ) => {
    const busy = isLoading || loading;

    const baseStyles =
      "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl font-semibold transition-all duration-250 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6600]/30";

    const sizeStyles =
      size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-6 py-3";

    const variants = {
      primary:
        "bg-[#FF6600] text-white shadow-brand hover:bg-[#E65C00] hover:shadow-brand-hover",
      secondary:
        "border border-card-ring bg-card-surface text-main shadow-sm hover:border-colly/40 hover:bg-surface-muted hover:shadow-md",
      danger:
        "bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700 hover:shadow-red-500/40",
    };

    return (
      <button
        ref={ref}
        disabled={busy || disabled}
        className={`${baseStyles} ${sizeStyles} ${variants[variant]} ${className}`}
        {...props}
      >
        {busy && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
