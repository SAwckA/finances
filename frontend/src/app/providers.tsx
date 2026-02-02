"use client";

import { HeroUIProvider } from "@heroui/react";
import { AuthProvider } from "@/features/auth/auth-context";

type ProvidersProps = {
  children: React.ReactNode;
};

export function Providers({ children }: ProvidersProps) {
  return (
    <HeroUIProvider>
      <AuthProvider>{children}</AuthProvider>
    </HeroUIProvider>
  );
}
