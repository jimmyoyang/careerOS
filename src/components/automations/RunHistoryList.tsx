"use client";

import { zhLabel, zhMessage } from "@/lib/i18n/zh-CN";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Fragment } from "react";
import { APP_CONSTANTS } from "@/lib/constants";
import { RecordsCount } from "@/components/RecordsCount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Ban,
  Timer,
  History,
  Square,
  Loader2,
  Trash2,
} from "lucide-react";
import type { AutomationRun, FunnelStage } from "@/models/automation.model";
import { DeleteAlertDialog } from "@/components/DeleteAlertDialog";
import { deleteAutomationRun } from "@/actions/automation.actions";
import { toastSuccess, toastError } from "@/lib/toast";

interface RunHistoryListProps {
  runs: AutomationRun[];
  // Total runs for this automation across all pages (not just the loaded
  // ones), used to drive infinite scroll.
  totalRuns: number;
  loadingMore: boolean;
  onLoadMore: () => void;
  onDelete?: () => void;
}

function parseFunnel(funnelStats: string | null): FunnelStage[] {
  if (!funnelStats) return [];
  try {
    const parsed = JSON.parse(funnelStats);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const STATUS_CONFIG = {
  running: {
    icon: Clock,
    color: "text-blue-500",
    variant: "secondary" as const,
  },
  cancelling: {
    icon: Loader2,
    color: "text-amber-500",
    variant: "secondary" as const,
  },
  completed: {
    icon: CheckCircle2,
    color: "text-green-500",
    variant: "default" as const,
  },
  failed: {
    icon: XCircle,
    color: "text-red-500",
    variant: "destructive" as const,
  },
  completed_with_errors: {
    icon: AlertCircle,
    color: "text-amber-500",
    variant: "secondary" as const,
  },
  blocked: {
    icon: Ban,
    color: "text-red-500",
    variant: "destructive" as const,
  },
  rate_limited: {
    icon: Timer,
    color: "text-amber-500",
    variant: "secondary" as const,
  },
  cancelled: {
    icon: Square,
    color: "text-muted-foreground",
    variant: "secondary" as const,
  },
};

export function RunHistoryList({
  runs,
  totalRuns,
  loadingMore,
  onLoadMore,
  onDelete,
}: RunHistoryListProps) {
  const [deleteRunId, setDeleteRunId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: auto-load next page when sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries[0].isIntersecting &&
          !loadingMore &&
          runs.length < totalRuns
        ) {
          onLoadMore();
        }
      },
      { threshold: APP_CONSTANTS.INTERSECTION_OBSERVER_THRESHOLD },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [runs.length, totalRuns, loadingMore, onLoadMore]);

  const handleDelete = async () => {
    if (!deleteRunId) return;
    const result = await deleteAutomationRun(deleteRunId);
    setDeleteRunId(null);
    if (result.success) {
      toastSuccess("运行记录已删除");
      onDelete?.();
    } else {
      toastError(result.message);
    }
  };

  if (runs.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <History className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">暂无运行记录</h3>
          <p className="text-muted-foreground text-center mt-2">
            自动化运行后，记录会显示在这里。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>运行记录</CardTitle>
          {totalRuns > 0 && (
            <RecordsCount count={runs.length} total={totalRuns} label="次运行" />
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>状态</TableHead>
                <TableHead>开始时间</TableHead>
                <TableHead>耗时</TableHead>
                <TableHead className="text-center">已检索</TableHead>
                <TableHead className="text-center">新增</TableHead>
                <TableHead className="text-center">已处理</TableHead>
                <TableHead className="text-center">已匹配</TableHead>
                <TableHead className="text-center">已保存</TableHead>
                <TableHead>错误</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => {
                const config =
                  STATUS_CONFIG[run.status] || STATUS_CONFIG.failed;
                const StatusIcon = config.icon;
                const duration = run.completedAt
                  ? Math.round(
                      (new Date(run.completedAt).getTime() -
                        new Date(run.startedAt).getTime()) /
                        1000,
                    )
                  : null;
                const funnel = parseFunnel(run.funnelStats);

                return (
                  <Fragment key={run.id}>
                    <TableRow>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StatusIcon className={`h-4 w-4 ${config.color}`} />
                          <Badge variant={config.variant}>
                            {zhLabel(run.status)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(run.startedAt), "M月d日 HH:mm")}
                      </TableCell>
                      <TableCell>
                        {duration !== null ? `${duration}秒` : "-"}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.jobsSearched}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.jobsDeduplicated}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.jobsProcessed}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.jobsMatched}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{run.jobsSaved}</span>
                      </TableCell>
                      <TableCell>
                        {(run.errorMessage || run.blockedReason) && (
                          <Badge
                            variant="outline"
                            className="max-w-md whitespace-normal"
                          >
                            {zhMessage(run.blockedReason || run.errorMessage || "")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRunId(run.id)}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {funnel.length > 0 && (
                      <TableRow className="hover:bg-transparent border-0">
                        <TableCell colSpan={10} className="pt-0 pb-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                            {funnel.map((stage, i) => (
                              <Fragment key={stage.key}>
                                {i > 0 && <span className="opacity-50">→</span>}
                                <span>
                                  {zhLabel(stage.label)}{" "}
                                  <span className="font-medium text-foreground">
                                    {stage.count}
                                  </span>
                                </span>
                              </Fragment>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
          {runs.length < totalRuns && (
            <div
              ref={sentinelRef}
              data-testid="runs-load-more-sentinel"
              className="flex justify-center p-4"
            >
              {loadingMore && (
                <Loader2
                  data-testid="runs-load-more-spinner"
                  className="h-5 w-5 animate-spin text-blue-500"
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteAlertDialog
        pageTitle="运行记录"
        open={!!deleteRunId}
        onOpenChange={(open) => !open && setDeleteRunId(null)}
        onDelete={handleDelete}
      />
    </>
  );
}
