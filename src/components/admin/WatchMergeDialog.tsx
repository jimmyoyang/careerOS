"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PROVIDER_META } from "@/components/automations/ats-search-step/types";
import type { JobBoard } from "@/models/automation.model";

export type PendingMerge = {
  provider: JobBoard;
  board: { name: string; token: string; host?: "default" | "eu" };
  existing: { id: string; label: string };
};

type Props = {
  pending: PendingMerge | null;
  onConfirm: () => void;
  onCancel: () => void;
};

// There is no "create a separate entry" option: @@unique([value, createdBy])
// forbids a second row with the same canonical value.
export function WatchMergeDialog({ pending, onConfirm, onCancel }: Props) {
  return (
    <AlertDialog open={!!pending} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>关联这个招聘平台？</AlertDialogTitle>
          <AlertDialogDescription>
            你已经在跟踪 <strong>{pending?.existing.label}</strong>。要将它的 {pending && PROVIDER_META[pending.provider].label} 招聘平台{" "}
            <code>{pending?.board.token}</code> 关联到该公司吗？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>关联招聘平台</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
