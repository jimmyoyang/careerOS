"use client";
import { useTransition } from "react";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toastActionResult } from "@/lib/toast";
import { unlinkStageInterviewer } from "@/actions/jobStage.actions";
import type { JobStage } from "@/models/jobStage.model";
import { stageInitials } from "./stageDisplay";

type StageInterviewersTabProps = {
  stage: JobStage;
  onLinkInterviewers: () => void;
  onChanged: () => void;
};

export function StageInterviewersTab({
  stage,
  onLinkInterviewers,
  onChanged,
}: StageInterviewersTabProps) {
  const [, startTransition] = useTransition();

  const unlink = (linkId: string) => {
    startTransition(async () => {
      const res = await unlinkStageInterviewer(linkId);
      toastActionResult(res, {
        success: "已解除面试官与该阶段的关联",
        onSuccess: onChanged,
      });
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-wide text-muted-foreground">
          面试官
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 cursor-pointer gap-1"
          onClick={onLinkInterviewers}
        >
          <UserPlus className="h-3 w-3" />
          添加面试官
        </Button>
      </div>

      {stage.interviewers.length === 0 ? (
        <p className="mt-2.5 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          尚未关联面试官。
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {stage.interviewers.map((link) => (
            <li key={link.id} className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground">
                {stageInitials(link.Contact.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">
                  {link.Contact.name}
                </span>
                {(link.Contact.title || link.Contact.Company) && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {[link.Contact.title, link.Contact.Company?.label]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                )}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 cursor-pointer"
                aria-label={`解除与${link.Contact.name}的关联`}
                onClick={() => unlink(link.id)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
