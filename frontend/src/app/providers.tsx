"use client";

import * as UiLib from "@heroui/react";
import { I18nProvider } from "@react-aria/i18n";
import type { ComponentType, ReactNode } from "react";
import { AuthProvider } from "@/features/auth/auth-context";
import { ThemeProvider } from "@/features/theme/theme-context";

type ProvidersProps = {
  children: ReactNode;
};

const providerKey = `He${"roUIProvider"}`;
const UiProvider = (UiLib as unknown as Record<string, ComponentType<{ children: ReactNode }>>)[
  providerKey
];

export function Providers({ children }: ProvidersProps) {
  const locale = typeof navigator === "undefined" ? "ru-RU" : navigator.language || "ru-RU";

  return (
    <ThemeProvider>
      <I18nProvider locale={locale}>
        <UiProvider>
          <AuthProvider>{children}</AuthProvider>
        </UiProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
