"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { CirclePlus } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Обзор" },
  { href: "/shopping-lists", label: "Покупки" },
  { href: "/recurring", label: "Повторяемые" },
  { href: "/profile", label: "Профиль" },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const quickAddActive = pathname === "/transactions";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Finances</p>
            <p className="text-sm font-semibold text-slate-900">{user?.name ?? "Пользователь"}</p>
          </div>
          <Button size="sm" variant="light" onPress={logout}>
            Выйти
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-5">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 backdrop-blur sm:px-4">
        <Link
          href="/transactions?create=1"
          className={`absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white shadow-lg transition ${
            quickAddActive
              ? "bg-slate-900 text-white"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
          aria-label="Быстро добавить операцию"
          title="Быстро добавить операцию"
        >
          <CirclePlus className="h-7 w-7" />
        </Link>

        <ul className="mx-auto grid w-full max-w-5xl grid-cols-4 gap-1">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex min-h-11 items-center justify-center rounded-xl px-1 text-center text-[11px] font-medium transition ${
                    active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
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
