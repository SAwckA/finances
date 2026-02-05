"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/features/auth/auth-context";

export default function RegisterPage() {
  const { register, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [router, status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setErrorMessage(null);

    try {
      await register({ email, name, password });
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setErrorMessage("Пользователь с таким email уже существует.");
      } else {
        setErrorMessage("Не удалось создать аккаунт. Попробуйте позже.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mobile-card space-y-4 p-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Create Account</h2>
        <p className="text-sm text-slate-500">Start tracking your finances in minutes.</p>
      </div>
      <form className="space-y-3" onSubmit={handleSubmit}>
        <label className="block text-sm text-slate-700">
          Name
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            required
          />
        </label>
        <label className="block text-sm text-slate-700">
          Email
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm text-slate-700">
          Password
          <input
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {errorMessage ? <p className="text-sm font-medium text-rose-700">{errorMessage}</p> : null}
        <button
          className="w-full rounded-xl bg-[var(--accent-primary)] px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-primary-strong)] disabled:cursor-not-allowed disabled:opacity-70"
          type="submit"
          disabled={pending}
        >
          {pending ? "Creating..." : "Create Account"}
        </button>
      </form>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/auth/login" className="font-semibold text-slate-900">
          Sign In
        </Link>
      </p>
    </section>
  );
}
