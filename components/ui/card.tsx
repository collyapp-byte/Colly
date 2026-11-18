import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  /** Merged last, so a page can still set its own margin or width. */
  className?: string;
  /**
   * Turns the card into a pointer target (a link wrapped around it, or a
   * clickable surface): hover lifts it and pressing settles it back down.
   */
  interactive?: boolean;
}

/**
 * The dashboard's default surface.
 *
 * The depth, ring and gradient all live in `.surface-card` (app/globals.css) so
 * every card in the app shares one elevation ladder and one 250ms easing curve;
 * a page only decides padding and layout from here.
 */
export function Card({ children, className, interactive = false }: CardProps) {
  return (
    <div
      className={`surface-card p-6 ${interactive ? "surface-card-interactive" : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className ?? ""}`}>
      <div>
        <h3 className="text-sm font-semibold text-main">{title}</h3>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
