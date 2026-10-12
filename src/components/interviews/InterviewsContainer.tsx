"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { Card, CardContent, CardTitle } from "../ui/card";
import { AddStageDialog } from "@/components/AddStageDialog";
import { ResponsiveCardHeader } from "../ResponsiveCardHeader";
import Loading from "../Loading";
import { RecordsCount } from "../RecordsCount";
import { SearchInput } from "../SearchInput";
import InterviewsTable from "./InterviewsTable";
import { InterviewFilters } from "./interviews-container/InterviewFilters";
import { useInterviewsList } from "./interviews-container/useInterviewsList";
import type {
  InterviewFilterOption,
  InterviewRow as InterviewRowType,
} from "@/models/interview.model";
import type { JobStageTypeRef } from "@/models/jobStage.model";
import type { JobStatus } from "@/models/job.model";

export type InterviewsContainerProps = {
  rounds: InterviewFilterOption[];
  companies: InterviewFilterOption[];
  stageTypes: JobStageTypeRef[];
  jobStatuses: JobStatus[];
};

function InterviewsContainer({
  rounds,
  companies,
  stageTypes,
  jobStatuses,
}: InterviewsContainerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [stageTypeId, setStageTypeId] = useState<string | undefined>(undefined);
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<InterviewRowType | null>(null);
  const router = useRouter();

  const list = useInterviewsList(searchTerm, stageTypeId, companyId);

  const filtered = !!searchTerm || !!stageTypeId || !!companyId;

  // The list and the page's filter options both go stale after a save: a round
  // can change type, date or company, which changes what the dropdowns offer.
  const onChanged = () => {
    void list.reload();
    router.refresh();
  };

  return (
    <>
      <Card x-chunk="dashboard-interviews-chunk-0">
        <ResponsiveCardHeader>
          <div className="flex items-baseline gap-2">
            <CardTitle>面试</CardTitle>
            {!list.initialLoading && list.total > 0 && (
              <RecordsCount
                count={list.interviews.length}
                total={list.total}
                label="面试"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:ml-auto">
            <InterviewFilters
              rounds={rounds}
              companies={companies}
              stageTypeId={stageTypeId}
              companyId={companyId}
              onRoundChange={setStageTypeId}
              onCompanyChange={setCompanyId}
            />
            <SearchInput
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="搜索面试…"
            />
          </div>
        </ResponsiveCardHeader>
        <CardContent>
          {list.initialLoading ? (
            <Loading />
          ) : list.interviews.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {filtered
                ? "没有符合筛选条件的面试。"
                : "暂无面试。在职位的进展记录中添加面试阶段后，就会显示在这里。"}
            </p>
          ) : (
            <>
              <InterviewsTable
                interviews={list.interviews}
                expandedId={expandedId}
                onToggle={(id) =>
                  setExpandedId((prev) => (prev === id ? null : id))
                }
                onEdit={setEditTarget}
                onChanged={onChanged}
              />
              {list.hasMore && (
                <div
                  ref={list.sentinelRef}
                  className="flex justify-center py-4"
                >
                  {list.loadingMore && (
                    <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {editTarget && (
        <AddStageDialog
          open
          jobId={editTarget.Job.id}
          jobLabel={`${editTarget.Job.JobTitle.label} · ${editTarget.Job.Company.label}`}
          stage={editTarget}
          stageTypes={stageTypes}
          jobStatuses={jobStatuses}
          onOpenChange={(open) => !open && setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

export default InterviewsContainer;
