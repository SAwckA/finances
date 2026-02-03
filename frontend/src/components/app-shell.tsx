"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  CirclePlus,
  Home,
  LogOut,
  Settings,
  UserCircle2,
} from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

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
  const { user, logout } = useAuth();
  const quickAddActive = pathname === "/transactions" || pathname.startsWith("/transactions?");

  return (
    <div className="mobile-page pb-24">
      <header className="sticky top-0 z-30 px-3 pt-3">
        <div className="dark-hero rounded-[20px] border border-white/15 px-3.5 py-3 shadow-[var(--shadow-strong)]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white/95">Good morning</p>
              <p className="truncate text-xs text-white/70">{user?.name ?? "Пользователь"}</p>
            </div>
            <button
              type="button"
              className="tap-highlight-none inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white/85 transition hover:bg-white/20"
              onClick={logout}
              aria-label="Выйти"
              title="Выйти"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="px-3 pb-4 pt-3">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px] border-t border-[color:var(--border-soft)] bg-white/97 px-3 pb-[calc(env(safe-area-inset-bottom)+0.4rem)] pt-2 backdrop-blur">
        <Link
          href="/transactions?create=1"
          className={`tap-highlight-none absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border-4 border-white shadow-lg transition ${
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
                      ? "bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                      : "text-slate-500 hover:bg-slate-100"
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
    </div>
  );
}
