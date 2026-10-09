"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCheck,
  FileText,
  RefreshCw,
} from "lucide-react";
import { cancelRunAction, getWorkspaceAction } from "@/actions/career";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportJobs } from "./ImportJobs";
import { FactsLibrary } from "./FactsLibrary";
import { Preparation } from "./Preparation";
import {
  ActionError,
  Section,
  statusLabel,
  useCareerAction,
  type Workspace,
} from "./shared";

export function CareerWorkbench({
  initialWorkspace,
  initialError,
  initialJobId = "",
}: {
  initialWorkspace: Workspace | null;
  initialError: string;
  initialJobId?: string;
}) {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [error, setError] = useState(initialError);
  const [tab, setTab] = useState(initialJobId ? "preparation" : "import");
  const [jobId, setJobId] = useState(initialJobId);
  const [refreshing, setRefreshing] = useState(false);
  const reload = useCallback(async () => {
    setRefreshing(true);
    try {
      const result = await getWorkspaceAction();
      if (result.ok) {
        setWorkspace(result.data);
        setError("");
      } else setError(`${result.error.message}（${result.error.code}）`);
    } catch {
      setError("加载工作台失败，请稍后重试。");
    } finally {
      setRefreshing(false);
    }
  }, []);
  const active =
    workspace?.runs.some((run) => ["queued", "running"].includes(run.status)) ??
    false;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => void reload(), 3000);
    return () => clearInterval(timer);
  }, [active, reload]);
  const action = useCareerAction(reload);
  const selectJob = (id: string) => {
    setJobId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("jobId", id);
    else url.searchParams.delete("jobId");
    window.history.replaceState(null, "", url);
  };

  return (
    <div className="col-span-3 mx-auto w-full min-w-0 max-w-7xl space-y-7 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              CareerOS
            </span>
            <Badge variant="outline">v0.1</Badge>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            让每一次投递都有依据
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            整理岗位，确认经历，准备材料。把真实事实与岗位要求连起来。
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
          onClick={() => void reload()}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          刷新
        </Button>
      </header>
      <ActionError message={error} />
      {workspace && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: "岗位总数",
                value: workspace.jobs.length,
                icon: BriefcaseBusiness,
              },
              {
                label: "已确认事实",
                value: workspace.evidence.filter(
                  (item) => item.status === "confirmed",
                ).length,
                icon: CheckCheck,
              },
              {
                label: "简历材料",
                value: workspace.materials.length,
                icon: FileText,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-xl border bg-card p-4 sm:p-5">
                <div className="mb-3 flex items-center justify-between gap-2 text-muted-foreground">
                  <span className="text-xs sm:text-sm">{label}</span>
                  <Icon className="hidden h-4 w-4 sm:block" />
                </div>
                <p className="text-2xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="mb-5 grid h-auto w-full grid-cols-4 sm:w-fit">
              <TabsTrigger value="import">岗位导入</TabsTrigger>
              <TabsTrigger value="facts">事实库</TabsTrigger>
              <TabsTrigger value="preparation">岗位准备</TabsTrigger>
              <TabsTrigger value="runs">
                任务记录
                {active && (
                  <span className="ml-2 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="import">
              <ImportJobs
                onChanged={reload}
                onImported={(id) => {
                  selectJob(id);
                  setTab("preparation");
                }}
              />
            </TabsContent>
            <TabsContent value="facts">
              <FactsLibrary workspace={workspace} onChanged={reload} />
            </TabsContent>
            <TabsContent value="preparation">
              <Preparation
                workspace={workspace}
                jobId={jobId}
                onSelect={selectJob}
                onChanged={reload}
              />
            </TabsContent>
            <TabsContent value="runs">
              <Section
                title="任务记录"
                description="后台任务在此保留进度和错误信息。页面关闭后任务仍可继续执行。"
              >
                <ActionError message={action.error} />
                {workspace.runs.length === 0 && (
                  <p className="py-6 text-sm text-muted-foreground">
                    暂无任务。导入岗位后即可开始分析。
                  </p>
                )}
                {workspace.runs.map((run) => {
                  const job = workspace.jobs.find(
                    (item) => item.id === run.jobId,
                  );
                  return (
                    <article
                      key={run.id}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border p-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-medium">
                          {(
                            {
                              match: "岗位匹配",
                              tailor: "简历草稿",
                              compile: "PDF 编译",
                              application_plan: "投递计划",
                              application: "投递计划",
                              import: "岗位导入",
                            } as Record<string, string>
                          )[run.kind] ?? run.kind}{" "}
                          · {job ? `${job.company} / ${job.title}` : "岗位"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.createdAt).toLocaleString("zh-CN")} ·{" "}
                          {run.step}
                        </p>
                        {run.errorCode && (
                          <p className="text-xs text-destructive">
                            错误：{run.errorCode}
                            。检查输入后可在岗位准备页重新发起。
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            run.status === "failed" ? "destructive" : "outline"
                          }
                        >
                          {statusLabel(run.status)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            selectJob(run.jobId ?? "");
                            setTab("preparation");
                          }}
                        >
                          查看
                          <ArrowUpRight className="ml-1 h-3 w-3" />
                        </Button>
                        {["queued", "running"].includes(run.status) && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={action.busy}
                            onClick={() =>
                              void action.run(() => cancelRunAction(run.id))
                            }
                          >
                            取消
                          </Button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </Section>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
