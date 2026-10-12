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
import { buttonVariants } from "@/components/ui/button";

interface AutomationDetailDialogsProps {
  abortConfirmOpen: boolean;
  onAbortConfirmOpenChange: (open: boolean) => void;
  onAbortRun: () => void;
  deleteConfirmOpen: boolean;
  onDeleteConfirmOpenChange: (open: boolean) => void;
  onDelete: () => void;
  isDeleting: boolean;
}

export function AutomationDetailDialogs({
  abortConfirmOpen,
  onAbortConfirmOpenChange,
  onAbortRun,
  deleteConfirmOpen,
  onDeleteConfirmOpenChange,
  onDelete,
  isDeleting,
}: AutomationDetailDialogsProps) {
  return (
    <>
      <AlertDialog
        open={abortConfirmOpen}
        onOpenChange={onAbortConfirmOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>中止本次运行？</AlertDialogTitle>
            <AlertDialogDescription>
              当前步骤完成后将停止运行。已发现的岗位会保留，其余岗位将不再处理。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续运行</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={(e) => {
                e.preventDefault();
                onAbortRun();
              }}
            >
              中止运行
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={onDeleteConfirmOpenChange}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除自动化</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除此自动化？此操作无法撤销。已发现的岗位将保留，但会解除与此自动化的关联。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              disabled={isDeleting}
              className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
            >
              {isDeleting ? "正在删除…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
