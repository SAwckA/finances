"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHeader, Input } from "@heroui/react";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/features/auth/auth-context";

export default function LoginPage() {
  const { login, status } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
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
      await login({ email, password });
      router.replace("/dashboard");
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setErrorMessage("Неверный email или пароль.");
      } else {
        setErrorMessage("Не удалось выполнить вход. Попробуйте позже.");
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <Card className="mt-10 border border-slate-200 shadow-none">
      <CardHeader className="flex flex-col items-start pb-0">
        <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Finances</p>
        <h1 className="text-xl font-semibold text-slate-900">Вход</h1>
      </CardHeader>
      <CardBody>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            type="email"
            label="Email"
            isRequired
            value={email}
            onValueChange={setEmail}
            autoComplete="email"
          />
          <Input
            type="password"
            label="Пароль"
            isRequired
            value={password}
            onValueChange={setPassword}
            autoComplete="current-password"
          />
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          <Button className="w-full" color="primary" type="submit" isLoading={pending}>
            Войти
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          Нет аккаунта?{" "}
          <Link href="/auth/register" className="font-medium text-slate-900">
            Регистрация
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
