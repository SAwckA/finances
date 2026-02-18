"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
import { motion } from "framer-motion";
import { BarChart3, CirclePlus, Home, Settings, UserCircle2 } from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Главная", icon: Home },
  { href: "/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
  { href: "/profile", label: "Профиль", icon: UserCircle2 },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isQueryEditor(searchParams: URLSearchParams): boolean {
  const create = searchParams.get("create");
  const edit = searchParams.get("edit");
  const createList = searchParams.get("createList");

  return create === "1" || create === "true" || Boolean(edit) || Boolean(createList);
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
    pathname.endsWith("/new") ||
    pathname.endsWith("/edit") ||
    isCreateMode ||
    isTransactionDetailsMode ||
    pathname === "/shopping-lists" ||
    pathname.startsWith("/shopping-lists/") ||
    isQueryEditor(searchParams);

  return (
    <div className={`mobile-page ${isEditorScreen ? "" : "pb-24"}`}>
      <motion.main
        key={pathname}
        animate={{ opacity: 1, y: 0 }}
        className={isEditorScreen ? "" : "px-3 pb-4 pt-2.5"}
        initial={{ opacity: 0, y: 6 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        {children}
      </motion.main>

      {!isEditorScreen ? (
        <motion.nav
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[430px] isolate rounded-t-[24px] bg-[#e3edf6] px-3 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2.5 shadow-[0_-12px_28px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-[#0d1a2d] dark:shadow-[0_-16px_40px_rgba(2,6,23,0.45),inset_0_1px_0_rgba(255,255,255,0.12)]"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <Link
            aria-label="Быстро добавить транзакцию"
            className={`tap-highlight-none absolute left-1/2 top-0 inline-flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[20px] shadow-[0_14px_30px_rgba(6,182,212,0.42),inset_0_1px_0_rgba(255,255,255,0.24)] transition ${
              quickAddActive
                ? "bg-[var(--accent-primary-strong)] text-white"
                : "bg-[linear-gradient(135deg,#22d3ee_0%,#06b6d4_55%,#0891b2_100%)] text-white hover:brightness-110"
            }`}
            href="/transactions?create=1"
            title="Быстро добавить транзакцию"
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
                    className={`tap-highlight-none flex min-h-11 flex-col items-center justify-center rounded-xl px-1 text-center text-[11px] font-semibold transition ${
                      active ? "nav-chip-active" : "nav-chip-idle"
                    }`}
                    href={item.href}
                  >
                    <Icon className="mb-0.5 h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.nav>
      ) : null}
    </div>
  );
}
