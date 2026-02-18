"use client";

import { HeroUIProvider } from "@heroui/react";
import { I18nProvider } from "@react-aria/i18n";
import { AuthProvider } from "@/features/auth/auth-context";
import { ThemeProvider } from "@/features/theme/theme-context";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  const locale = typeof navigator === "undefined" ? "ru-RU" : navigator.language || "ru-RU";

  return (
    <ThemeProvider>
      <I18nProvider locale={locale}>
        <HeroUIProvider>
          <AuthProvider>{children}</AuthProvider>
        </HeroUIProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
