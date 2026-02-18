"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@heroui/react";
import { useAuth } from "@/features/auth/auth-context";

export default function HomePage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
      return;
    }

    if (status === "unauthenticated") {
      router.replace("/auth/login");
    }
  }, [router, status]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-default-50">
      <div className="flex items-center gap-2 text-default-600">
        <Spinner size="sm" />
        <span className="text-sm">Перенаправляем...</span>
      </div>
    </main>
  );
}
