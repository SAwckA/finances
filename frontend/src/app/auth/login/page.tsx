"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/features/auth/auth-context";

export default function LoginPage() {
  const { startGoogleLogin, status } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  const handleGoogleLogin = async () => {
    setPending(true);
    setErrorMessage(null);

    try {
      await startGoogleLogin();
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage("Не удалось начать авторизацию через Google.");
      } else {
        setErrorMessage("Сервис авторизации временно недоступен.");
      }
      setPending(false);
    }
  };

  return (
    <section className="app-panel space-y-4 p-4">
      <div>
        <h2 className="text-xl font-bold text-default-900">Sign In</h2>
        <p className="text-sm text-default-500">Continue with Google to access your workspace.</p>
      </div>

      {errorMessage ? <p className="text-sm font-medium text-danger-700">{errorMessage}</p> : null}

      <button
        className="w-full rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
        type="button"
        onClick={handleGoogleLogin}
        disabled={pending}
      >
        {pending ? "Redirecting..." : "Continue with Google"}
      </button>
    </section>
  );
}
