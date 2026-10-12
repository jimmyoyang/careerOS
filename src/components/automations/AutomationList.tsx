"use client";

import { zhLabel } from "@/lib/i18n/zh-CN";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toastSuccess, toastError } from "@/lib/toast";
import {
  MoreVertical,
  Pause,
  Play,
  Pencil,
  Trash2,
  Clock,
  FileText,
  AlertTriangle,
  Zap,
} from "lucide-react";
import type { AutomationWithResume } from "@/models/automation.model";
import { isRetiredBoard } from "@/models/automation.model";
import {
  deleteAutomation,
  pauseAutomation,
  resumeAutomation,
} from "@/actions/automation.actions";
import { APP_CONSTANTS } from "@/lib/constants";
import Link from "next/link";

interface AutomationListProps {
  automations: AutomationWithResume[];
  onEdit: (automation: AutomationWithResume) => void;
  onRefresh: () => void;
}

export function AutomationList({
  automations,
  onEdit,
  onRefresh,
}: AutomationListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const handlePause = async (id: string) => {
    setLoadingAction(id);
    const result = await pauseAutomation(id);
    setLoadingAction(null);

    if (result.success) {
      toastSuccess("自动化已暂停");
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  const handleResume = async (id: string) => {
    setLoadingAction(id);
    const result = await resumeAutomation(id);
    setLoadingAction(null);

    if (result.success) {
      toastSuccess("自动化已恢复");
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    setIsDeleting(true);
    const result = await deleteAutomation(deleteId);
    setIsDeleting(false);
    setDeleteId(null);

    if (result.success) {
      toastSuccess("自动化已删除");
      onRefresh();
    } else {
      toastError(result.message);
    }
  };

  if (automations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Zap className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">暂无自动化</h3>
          <p className="text-muted-foreground text-center mt-2">
            创建第一个自动化，开始自动发现岗位。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {automations.map((automation) => {
          const isLoading = loadingAction === automation.id;
          const resumeMissing = !automation.resume;

          const retired = isRetiredBoard(automation.jobBoard);
          const ats = (() => {
            try {
              return JSON.parse(automation.sourceConfig ?? "{}")[
                automation.jobBoard
              ];
            } catch {
              return null;
            }
          })();
          const atsCompanies: { name: string; token: string }[] =
            ats?.companies ?? [];
          const atsTitles: string[] = ats?.targetTitles ?? [];
          const atsLocations: string[] = ats?.locations ?? [];
          const atsKeywords: string[] = ats?.keywords ?? [];
          const atsTopK: number = ats?.topK ?? APP_CONSTANTS.MAX_JOBS_PER_RUN;
          const atsSaveUnanalyzed: boolean = ats?.saveUnanalyzed !== false;

          return (
            <div
              key={automation.id}
              className="flex items-start justify-between p-4 rounded-lg border bg-card"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/dashboard/automations/${automation.id}`}
                    className="font-semibold hover:underline"
                  >
                    {automation.name}
                  </Link>
                  <Badge variant="outline" className="capitalize">
                    {automation.jobBoard}
                  </Badge>
                  {retired ? (
                    <Badge variant="destructive">已停用</Badge>
                  ) : (
                    <Badge
                      variant={
                        automation.status === "active" ? "default" : "secondary"
                      }
                    >
                      {zhLabel(automation.status)}
                    </Badge>
                  )}
                </div>

                {retired && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>
                      此招聘平台已移除，无法继续运行。请删除此自动化。
                    </span>
                  </div>
                )}

                {!retired && resumeMissing && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>简历缺失，请重新选择</span>
                  </div>
                )}

                {!retired && (
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex flex-wrap items-center gap-1">
                      {atsCompanies.slice(0, 3).map((c) => (
                        <Badge key={c.token} variant="secondary">
                          {c.name}
                        </Badge>
                      ))}
                      {atsCompanies.length > 3 && (
                        <Badge variant="secondary">
                          +{atsCompanies.length - 3} 家
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      <span>
                        <span className="font-medium text-foreground">
                          目标职位：
                        </span>{" "}
                        {atsTitles.length ? atsTitles.join(", ") : "未设置"}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          关键词：
                        </span>{" "}
                        {atsKeywords.length ? atsKeywords.join(", ") : "不限"}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          地点：
                        </span>{" "}
                        {atsLocations.length
                          ? atsLocations.join(", ")
                          : "不限地点"}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          每次分析：
                        </span>{" "}
                        {atsTopK}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">
                          其他岗位：
                        </span>{" "}
                        {atsSaveUnanalyzed ? "开启" : "关闭"}
                      </span>
                      {automation.resume && (
                        <span>
                          <span className="font-medium text-foreground">
                            简历：
                          </span>{" "}
                          {automation.resume.title}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {automation.scheduleHour.toString().padStart(2, "0")}:00 每日运行
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    <span>{automation.matchThreshold}% 匹配阈值</span>
                  </div>
                  {!retired &&
                    automation.nextRunAt &&
                    automation.status === "active" && (
                      <span className="text-xs">
                        下次运行：{" "}
                        {format(
                          new Date(automation.nextRunAt),
                          "M月d日 HH:mm",
                        )}
                      </span>
                    )}
                  {automation.lastRunAt && (
                    <span className="text-xs">
                      最近运行：{" "}
                      {format(new Date(automation.lastRunAt), "M月d日 HH:mm")}
                    </span>
                  )}
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" disabled={isLoading}>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {!retired &&
                    (automation.status === "active" ? (
                      <DropdownMenuItem
                        onClick={() => handlePause(automation.id)}
                      >
                        <Pause className="h-4 w-4 mr-2" />
                        暂停
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        onClick={() => handleResume(automation.id)}
                        disabled={resumeMissing}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        恢复
                      </DropdownMenuItem>
                    ))}
                  {!retired && (
                    <>
                      <DropdownMenuItem onClick={() => onEdit(automation)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        编辑
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => setDeleteId(automation.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    删除
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
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
              onClick={handleDelete}
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
