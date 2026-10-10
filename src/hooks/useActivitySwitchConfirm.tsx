"use client";
import { useCallback, useState } from "react";
import { useActivity } from "@/context/ActivityContext";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";

// Returning false means the start was rejected; anything else counts as done.
type StartAction = () => boolean | void | Promise<boolean | void>;

export function useActivitySwitchConfirm() {
  const { currentActivity, stopActivity, refreshCurrentActivity } =
    useActivity();
  const [pendingAction, setPendingAction] = useState<StartAction | null>(null);
  const [dialogActivity, setDialogActivity] = useState<typeof currentActivity>(currentActivity);

  // The running activity is a per-user singleton, so another session may have
  // claimed it since this page last synced — a start that looked valid against
  // local state gets rejected server-side. Resync and offer the switch rather
  // than dead-ending on an error toast.
  const runStart = useCallback(
    async (action: StartAction) => {
      const started = await action();
      if (started !== false) return;
      const running = await refreshCurrentActivity();
      if (running) {
        setDialogActivity(running);
        setPendingAction(() => action);
      }
    },
    [refreshCurrentActivity],
  );

  const requestStart = useCallback(
    (action: StartAction) => {
      if (currentActivity) {
        setDialogActivity(currentActivity);
        setPendingAction(() => action);
      } else {
        runStart(action);
      }
    },
    [currentActivity, runStart],
  );

  const confirmSwitch = useCallback(async () => {
    const action = pendingAction;
    setPendingAction(null);
    setDialogActivity(undefined);
    if (!action) return;
    await stopActivity();
    await runStart(action);
  }, [pendingAction, stopActivity, runStart]);

  const confirmDialog = (
    <DeleteAlertDialog
      pageTitle="activity"
      open={pendingAction !== null}
      onOpenChange={(open) => !open && setPendingAction(null)}
      onDelete={confirmSwitch}
      alertTitle="结束当前活动并开始新活动？"
      alertDescription={
        dialogActivity
          ? `“${dialogActivity.activityName}”正在进行中。是否结束并开始新活动？`
          : undefined
      }
      actionLabel="结束并开始"
      actionVariant="default"
    />
  );

  return { requestStart, confirmDialog };
}
