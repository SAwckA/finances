"use client";

import { Button, Card, CardBody, CardHeader, Chip, Input } from "@heroui/react";
import { useState } from "react";

export function HeroDemo() {
  const [goal, setGoal] = useState("");

  return (
    <Card className="w-full max-w-xl border border-white/10 bg-slate-900/70 backdrop-blur">
      <CardHeader className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            Finances UI
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">
            HeroUI подключен
          </h1>
        </div>
        <Chip color="success" variant="flat">
          Ready
        </Chip>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="text-sm text-slate-300">
          Это тестовая страница: Next.js + Tailwind CSS v4 + HeroUI.
        </p>
        <Input
          label="Финансовая цель"
          placeholder="Например, накопить 300 000 ₽"
          value={goal}
          onValueChange={setGoal}
          variant="bordered"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {goal ? `Текущая цель: ${goal}` : "Введите цель выше"}
          </span>
          <Button color="primary" variant="shadow">
            Сохранить
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
