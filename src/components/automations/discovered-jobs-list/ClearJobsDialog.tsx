"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
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
import { buttonVariants } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/lib/toast";
import { clearDiscoveredJobs } from "@/actions/automation.actions";

interface ClearJobsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  includeNew: boolean;
  onIncludeNewChange: (includeNew: boolean) => void;
  newCount: number;
  automationId: string;
  onRefresh: () => void;
}

export function ClearJobsDialog({
  open,
  onOpenChange,
  includeNew,
  onIncludeNewChange,
  newCount,
  automationId,
  onRefresh,
}: ClearJobsDialogProps) {
  const [clearing, setClearing] = useState(false);

  const handleClear = async () => {
    setClearing(true);
    const result = await clearDiscoveredJobs({
      automationId,
      includeNew,
    });
    setClearing(false);
    onOpenChange(false);

    if (result.success) {
      toastSuccess(`已移除 ${result.deleted ?? 0} 个岗位。`, "已清空发现的岗位");
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>清空发现的岗位？</AlertDialogTitle>
          <AlertDialogDescription>
            已接受的岗位会保留。此操作将永久删除所有已忽略的岗位
            {includeNew && newCount > 0 ? "以及所有尚未审核的新岗位" : ""}
            。此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        {newCount > 0 && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={includeNew}
              onChange={(e) => onIncludeNewChange(e.target.checked)}
            />
            同时删除 {newCount} 个尚未审核的新岗位
          </label>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={clearing}>取消</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={clearing}
            onClick={(e) => {
              e.preventDefault();
              handleClear();
            }}
          >
            {clearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "删除"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
