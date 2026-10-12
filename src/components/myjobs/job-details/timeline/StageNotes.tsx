"use client";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toastActionResult } from "@/lib/toast";
import { setStageNotes } from "@/actions/jobStage.actions";
import type { JobStage } from "@/models/jobStage.model";

type StageNotesProps = {
  stage: JobStage;
  onChanged: () => void;
};

export function StageNotes({ stage, onChanged }: StageNotesProps) {
  const [draft, setDraft] = useState(stage.notes ?? "");
  const [saving, startTransition] = useTransition();

  // Selecting another stage in the history list re-renders this component
  // with a different stage, so the draft has to follow the id, not mount.
  useEffect(() => {
    setDraft(stage.notes ?? "");
  }, [stage.id, stage.notes]);

  const dirty = draft !== (stage.notes ?? "");

  const save = () => {
    startTransition(async () => {
      const res = await setStageNotes(stage.id, draft);
      toastActionResult(res, { success: "笔记已保存", onSuccess: onChanged });
    });
  };

  return (
    <div>
      <label
        htmlFor={`stage-notes-${stage.id}`}
        className="text-[11px] font-bold tracking-wide text-muted-foreground"
      >
        笔记
      </label>
      <Textarea
        id={`stage-notes-${stage.id}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="记录本次情况及下次需要准备的内容…"
        className="mt-2 min-h-18 resize-none text-sm"
      />
      {/* Only once there is something to save: the artboard shows the edit
          state, not the resting state. */}
      {dirty && (
        <div className="mt-2 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => setDraft(stage.notes ?? "")}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="cursor-pointer"
            disabled={saving}
            onClick={save}
          >
            保存更改
          </Button>
        </div>
      )}
    </div>
  );
}
