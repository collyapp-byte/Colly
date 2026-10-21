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
      "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-150 active:scale-[0.96] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-4 focus:ring-[#FF6600]/30";

    const sizeStyles =
      size === "sm" ? "px-3 py-1.5 text-[13px]" : "px-6 py-3";

    const variants = {
      primary:
        "bg-[#FF6600] text-white shadow-lg shadow-orange-500/30 hover:bg-[#E65C00] hover:shadow-orange-500/50",
      secondary:
        "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300",
      danger:
        "bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/30",
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
