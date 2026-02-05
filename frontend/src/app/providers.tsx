"use client";

import { HeroUIProvider } from "@heroui/react";
import { AuthProvider } from "@/features/auth/auth-context";
import { ThemeProvider } from "@/features/theme/theme-context";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <HeroUIProvider>
        <AuthProvider>{children}</AuthProvider>
      </HeroUIProvider>
    </ThemeProvider>
  );
}
