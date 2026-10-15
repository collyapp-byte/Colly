import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors";

  const variantClasses: Record<ButtonVariant, string> = {
    primary: "bg-[#FF6600] text-white hover:bg-[#E65C00]",
    secondary: "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-[13px]",
    md: "px-4 py-2 text-sm",
  };

  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${
        isDisabled ? "cursor-not-allowed opacity-50" : ""
      } ${loading ? "cursor-wait" : ""} ${className}`}
    >
      {loading && (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden />
      )}
      <span className={loading ? "opacity-70" : ""}>{children}</span>
    </button>
  );
}
