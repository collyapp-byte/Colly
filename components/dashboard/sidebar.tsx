"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutGrid,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  QrCode,
  Settings,
  ShoppingCart,
  Smartphone,
  Sparkles,
  User,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/lib/auth-actions";
import { isActiveNavPath } from "@/lib/nav";
import { isOwnerOnlyPath } from "@/lib/team";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  /** Stable key for the collapse state; never derive it from the title. */
  id: string;
  title: string;
  items: NavItem[];
};

const SECTIONS: NavSection[] = [
  {
    id: "home",
    title: "Home",
    items: [
      { label: "Overview", href: "/dashboard", icon: LayoutGrid },
      { label: "Colly AI", href: "/ai", icon: Sparkles },
    ],
  },
  {
    id: "inbox",
    title: "Inbox",
    items: [
      { label: "Conversations", href: "/conversations", icon: MessageSquare },
    ],
  },
  {
    id: "sell",
    title: "Sell",
    items: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Sales", href: "/sales", icon: ShoppingCart },
      { label: "Invoices", href: "/invoices", icon: FileText },
      { label: "Bookings", href: "/bookings", icon: Calendar },
    ],
  },
  {
    id: "catalogue",
    title: "Catalogue",
    items: [
      { label: "Products", href: "/products", icon: Package },
      { label: "FAQs", href: "/faqs", icon: HelpCircle },
    ],
  },
  {
    id: "manage",
    title: "Manage",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "WhatsApp", href: "/settings/whatsapp", icon: Smartphone },
      { label: "QR Code", href: "/settings/qr-code", icon: QrCode },
      { label: "Find an Agent", href: "/find-an-agent", icon: MapPin },
      { label: "Team", href: "/settings/team", icon: UserCog },
    ],
  },
];

/* ---------------------------------------------------------------------------
   Folded groups.

   The fold state lives in localStorage, which is an external store, so it is
   read through `useSyncExternalStore` instead of a `setState` inside an effect
   (the hooks lint bans that, and it would also let the desktop rail and the
   mobile drawer drift apart). The server snapshot is always "everything open",
   so the server HTML and the hydrated client agree; the stored value is applied
   on the first client pass.
--------------------------------------------------------------------------- */

const COLLAPSED_SECTIONS_KEY = "colly:dashboard-sidebar:collapsed";
const COLLAPSED_SECTIONS_EVENT = "colly:dashboard-sidebar:collapsed-change";

const EMPTY_COLLAPSED: ReadonlySet<string> = new Set();
let collapsedCache: ReadonlySet<string> | null = null;

function parseCollapsed(raw: string | null): ReadonlySet<string> {
  if (!raw) return EMPTY_COLLAPSED;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_COLLAPSED;

    // Drop unknown ids, so a renamed or removed group cannot keep the rail
    // permanently short.
    const ids = parsed.filter(
      (id): id is string =>
        typeof id === "string" &&
        SECTIONS.some((section) => section.id === id),
    );
    return ids.length > 0 ? new Set(ids) : EMPTY_COLLAPSED;
  } catch {
    return EMPTY_COLLAPSED;
  }
}

function getCollapsedSnapshot(): ReadonlySet<string> {
  if (collapsedCache === null) {
    try {
      collapsedCache = parseCollapsed(
        window.localStorage.getItem(COLLAPSED_SECTIONS_KEY),
      );
    } catch {
      collapsedCache = EMPTY_COLLAPSED;
    }
  }
  return collapsedCache;
}

function getServerCollapsedSnapshot(): ReadonlySet<string> {
  return EMPTY_COLLAPSED;
}

function subscribeCollapsed(onChange: () => void) {
  function handleStorage(event: StorageEvent) {
    if (event.key !== COLLAPSED_SECTIONS_KEY) return;
    collapsedCache = null;
    onChange();
  }

  window.addEventListener(COLLAPSED_SECTIONS_EVENT, onChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(COLLAPSED_SECTIONS_EVENT, onChange);
    window.removeEventListener("storage", handleStorage);
  };
}

function writeCollapsed(next: ReadonlySet<string>) {
  collapsedCache = next;
  try {
    window.localStorage.setItem(
      COLLAPSED_SECTIONS_KEY,
      JSON.stringify([...next]),
    );
  } catch {
    // Private mode or full quota: the in-memory snapshot still folds for this
    // session, it just will not be remembered.
  }
  window.dispatchEvent(new Event(COLLAPSED_SECTIONS_EVENT));
}

const MENU_ITEM_CLASS =
  "flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-main transition-all duration-250 ease-out hover:-translate-y-px hover:bg-surface-muted active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40";

type SidebarProps = {
  /**
   * Server-rendered account details from the dashboard layout. When both are
   * provided the component does not call `/api/business` at all; the fetch
   * remains as a fallback for any other host of the rail.
   */
  ownerName?: string;
  ownerEmail?: string;
  onClose?: () => void;
  hasNoProducts?: boolean;
  hasNoFaqs?: boolean;
  hasPendingEscalations?: boolean;
  hasNoChannels?: boolean;
  isOwner?: boolean;
};

export function Sidebar({
  ownerName,
  ownerEmail,
  onClose,
  hasNoProducts = false,
  hasNoFaqs = false,
  hasPendingEscalations = false,
  hasNoChannels = false,
  isOwner = true,
}: SidebarProps) {
  const pathname = usePathname();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [accountName, setAccountName] = useState(ownerName ?? "");
  const [accountEmail, setAccountEmail] = useState(ownerEmail ?? "");
  const switcherRef = useRef<HTMLDivElement>(null);

  const collapsedSections = useSyncExternalStore(
    subscribeCollapsed,
    getCollapsedSnapshot,
    getServerCollapsedSnapshot,
  );

  function shouldShowDot(href: string): boolean {
    return (
      (href === "/products" && hasNoProducts) ||
      (href === "/faqs" && hasNoFaqs) ||
      (href === "/ai" && hasNoChannels) ||
      (href === "/conversations" && hasPendingEscalations)
    );
  }

  function toggleSection(id: string) {
    const next = new Set(collapsedSections);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    writeCollapsed(next);
  }

  /** Dismiss the mobile drawer and the account menu in one tap. */
  function handleNavigate() {
    setSwitcherOpen(false);
    onClose?.();
  }

  // The owner's name and email for the account menu. The dashboard layout now
  // passes both as server props, so this only runs for a host that renders the
  // rail without them; the API falls back to the email prefix either way.
  useEffect(() => {
    if (ownerName && ownerEmail) return;

    let active = true;
    fetch("/api/business")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { ownerEmail?: string; ownerName?: string } | null) => {
        if (!active || !data) return;
        if (data.ownerEmail) setAccountEmail(data.ownerEmail);
        if (data.ownerName) {
          setAccountName(data.ownerName);
        } else if (data.ownerEmail) {
          const prefix = data.ownerEmail.split("@")[0] || data.ownerEmail;
          setAccountName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ownerEmail, ownerName]);

  // Close the account menu on click outside or Escape.
  useEffect(() => {
    if (!switcherOpen) return;
    function handleMouseDown(event: MouseEvent) {
      if (
        switcherRef.current &&
        !switcherRef.current.contains(event.target as Node)
      ) {
        setSwitcherOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSwitcherOpen(false);
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [switcherOpen]);

  const accountInitial = (accountName || accountEmail)
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <div className="flex h-full w-full flex-col border-r border-card-ring bg-card-surface/75 shadow-card backdrop-blur-xl">
      {/* Brand — always leads home, and dismisses the drawer on mobile. */}
      <div className="flex h-14 shrink-0 items-center border-b border-card-ring px-4">
        <Link
          href="/dashboard"
          onClick={handleNavigate}
          className="mx-2 flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-250 ease-out hover:-translate-y-px hover:bg-surface-muted active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-colly-tint ring-1 ring-colly/15">
            <Image src="/logo.svg" alt="" aria-hidden width={28} height={28} />
          </span>
          <span className="truncate text-sm font-semibold text-main">
            Colly
          </span>
        </Link>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-2 py-3">
        <nav aria-label="Main navigation" className="flex flex-col gap-4">
          {SECTIONS.map((section) => {
            const items = section.items.filter(
              (item) => isOwner || !isOwnerOnlyPath(item.href),
            );
            if (items.length === 0) return null;

            // The group that owns the current page stays open and renders as a
            // plain heading: a toggle there would immediately unfold itself.
            const sectionHasActive = items.some((item) =>
              isActiveNavPath(pathname, item.href),
            );
            const collapsible = items.length > 1 && !sectionHasActive;
            const open = !collapsible || !collapsedSections.has(section.id);
            const listId = `sidebar-section-${section.id}`;

            return (
              <div key={section.id}>
                {collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    aria-expanded={open}
                    aria-controls={listId}
                    className="flex min-h-[36px] w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase transition-all duration-250 hover:text-main active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40 md:min-h-0"
                  >
                    <span>{section.title}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                        open ? "" : "-rotate-90"
                      }`}
                      aria-hidden
                    />
                  </button>
                ) : (
                  <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
                    {section.title}
                  </div>
                )}

                {/* 1fr → 0fr animates the group without measuring it; the row
                    is not focusable while folded (`inert`). */}
                <div
                  id={listId}
                  inert={!open}
                  className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                    open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <ul className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                    {items.map((item) => {
                      const active = isActiveNavPath(pathname, item.href);
                      const Icon = item.icon;

                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            onClick={handleNavigate}
                            className={`group flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-all duration-250 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40 md:h-9 ${
                              active
                                ? "bg-colly-tint text-colly nav-active-texture shadow-[inset_0_0_0_1px_rgba(255,102,0,0.18),0_2px_6px_-2px_rgba(255,102,0,0.25)]"
                                : "text-main hover:-translate-y-px hover:bg-surface-muted hover:text-main hover:shadow-sm"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 stroke-[1.5] transition-all duration-250 ${
                                active
                                  ? "text-colly"
                                  : "text-muted group-hover:text-main"
                              }`}
                              aria-hidden
                            />
                            <span className="truncate">{item.label}</span>
                            {shouldShowDot(item.href) && (
                              <>
                                <span
                                  className="ml-auto h-2 w-2 shrink-0 rounded-full bg-colly"
                                  aria-hidden
                                />
                                <span className="sr-only">
                                  Needs attention
                                </span>
                              </>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Account menu — anchored to the footer, so it opens upward. */}
      <div
        ref={switcherRef}
        className="relative shrink-0 border-t border-card-ring px-2 py-2"
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={switcherOpen}
          onClick={() => setSwitcherOpen((open) => !open)}
          className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-all duration-250 ease-out hover:bg-surface-muted active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-colly/40"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-colly text-sm font-semibold text-white shadow-brand"
            aria-hidden
          >
            {accountInitial || <User className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-main">
              {accountName || "..."}
            </span>
            <span className="block text-[11px] text-muted">
              {isOwner ? "Owner" : "Staff"}
            </span>
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-150 ${
              switcherOpen ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        </button>

        {switcherOpen && (
          <div
            role="menu"
            aria-label="Account menu"
            className="surface-card absolute right-2 bottom-full left-2 z-50 mb-1.5 py-1.5 shadow-card-hover"
          >
            <div className="mx-1.5 mb-1 border-b border-card-ring px-3 pb-2">
              <p className="text-[11px] text-muted">Signed in as</p>
              <p className="truncate text-[13px] text-main">
                {accountEmail || "..."}
              </p>
            </div>
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setSwitcherOpen(false)}
              className={`mx-1.5 ${MENU_ITEM_CLASS}`}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden />
              Account settings
            </Link>
            {isOwner && (
              <Link
                href="/settings/billing"
                role="menuitem"
                onClick={() => setSwitcherOpen(false)}
                className={`mx-1.5 ${MENU_ITEM_CLASS}`}
              >
                <CreditCard className="h-3.5 w-3.5" aria-hidden />
                Billing &amp; plan
              </Link>
            )}
            <form action={logout} className="mx-1.5">
              <button
                type="submit"
                role="menuitem"
                className={`w-full hover:text-red-600 ${MENU_ITEM_CLASS}`}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}