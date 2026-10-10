"use client";

import { format } from "date-fns";
import { FileText, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TipTapContentViewer } from "@/components/TipTapContentViewer";
import type { CoverLetter } from "@/models/profile.model";
import { JobTabEmptyState } from "./JobTabEmptyState";

type CoverLetterTabProps = {
  letter?: CoverLetter;
  blockedReason?: string;
  onGenerate: () => void;
};

export function CoverLetterTab({
  letter,
  blockedReason,
  onGenerate,
}: CoverLetterTabProps) {
  if (!letter) {
    return (
      <JobTabEmptyState
        icon={FileText}
        title="暂无求职信"
        description="根据简历和职位信息生成求职信，之后可在个人资料中编辑和导出。"
        actionLabel="生成求职信"
        onAction={onGenerate}
        actionDisabled={!!blockedReason}
        actionTitle={blockedReason}
      />
    );
  }

  const generatedAt = letter.updatedAt ?? letter.createdAt;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs text-muted-foreground">
          {letter.title}
          {generatedAt &&
            ` · 生成于 ${format(new Date(generatedAt), "yyyy年M月d日")}`}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto cursor-pointer"
          onClick={onGenerate}
          disabled={!!blockedReason}
          title={blockedReason}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          重新生成
        </Button>
      </div>
      <TipTapContentViewer content={letter.content} />
    </div>
  );
}
