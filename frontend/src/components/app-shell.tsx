"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  CirclePlus,
  Home,
  Settings,
  UserCircle2,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/profile", label: "Profile", icon: UserCircle2 },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const quickAddActive = pathname === "/transactions" || pathname.startsWith("/transactions?");
  const isCreateMode =
    pathname === "/transactions" &&
    (searchParams.get("create") === "1" || searchParams.get("create") === "true");
  const isTransactionDetailsMode =
    (pathname.startsWith("/transactions/") && pathname !== "/transactions") ||
    (pathname.startsWith("/transaction/") && pathname !== "/transaction");
  const isEditorScreen =
    pathname.endsWith("/new") || pathname.endsWith("/edit") || isCreateMode || isTransactionDetailsMode;

  return (
    <div className={`mobile-page ${isEditorScreen ? "" : "pb-24"}`}>
      <main className={isEditorScreen ? "" : "px-3 pb-4 pt-2.5"}>{children}</main>

      {!isEditorScreen ? (
        <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px] border-t border-[color:var(--border-soft)] bg-[color:color-mix(in_srgb,var(--bg-card)_86%,transparent)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2.5 backdrop-blur-xl">
          <Link
            href="/transactions?create=1"
            className={`tap-highlight-none absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-4 border-[color:var(--bg-card)] shadow-lg transition ${
              quickAddActive
                ? "bg-[var(--accent-primary-strong)] text-white"
                : "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-strong)]"
            }`}
            aria-label="Быстро добавить операцию"
            title="Быстро добавить операцию"
          >
            <CirclePlus className="h-7 w-7" strokeWidth={2.25} />
          </Link>

          <ul className="mx-auto grid w-full grid-cols-4 gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`tap-highlight-none flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-center text-[11px] font-semibold transition ${
                      active
                        ? "bg-[var(--accent-primary)]/12 text-[var(--accent-primary)]"
                        : "surface-hover text-[var(--text-secondary)]"
                    }`}
                  >
                    <Icon className="mb-0.5 h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
