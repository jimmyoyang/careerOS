"use client";

import { useState, type ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type {
  getWorkspaceAction,
  getPreparationAction,
  createPlanAction,
} from "@/actions/career";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; retryable: boolean } };
export type Workspace = Extract<
  Awaited<ReturnType<typeof getWorkspaceAction>>,
  { ok: true }
>["data"];
export type PreparationData = Extract<
  Awaited<ReturnType<typeof getPreparationAction>>,
  { ok: true }
>["data"];
export type ApplicationPlan = Extract<
  Awaited<ReturnType<typeof createPlanAction>>,
  { ok: true }
>["data"];
export type Evidence = Workspace["evidence"][number];

export const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export const statusLabels: Record<string, string> = {
  queued: "排队中",
  running: "处理中",
  succeeded: "已完成",
  failed: "失败",
  cancelled: "已取消",
  needs_review: "待复核",
  awaiting_review: "待复核",
  awaiting_human: "待实际投递",
  needs_verification: "待核实",
  analyzing: "分析中",
  preparing: "准备中",
  ready: "已就绪",
  draft: "草稿",
  confirmed: "已确认",
  withdrawn: "已撤回",
  not_started: "未开始",
  completed: "已完成",
};
export const statusLabel = (value: string) => statusLabels[value] ?? value;

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Label className="flex min-w-0 flex-col items-stretch gap-2 text-sm font-medium">
      {label}
      {children}
    </Label>
  );
}

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && (
          <CardDescription className="leading-relaxed">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function useCareerAction(onChanged?: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run<T>(
    action: () => Promise<ActionResult<T>>,
  ): Promise<T | undefined> {
    setBusy(true);
    setError("");
    try {
      const result = await action();
      if (!result.ok) {
        setError(
          `${result.error.message}（${result.error.code}）${result.error.retryable ? "，可重试。" : ""}`,
        );
        return;
      }
      await onChanged?.();
      return result.data;
    } catch {
      setError("请求未完成，请检查连接后重试。");
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

export function ActionError({ message }: { message: string }) {
  return message ? (
    <p
      role="alert"
      className="rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </p>
  ) : null;
}
