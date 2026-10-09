"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import {
  acceptDraftAction,
  attachJobAction,
  enqueueAction,
  getPreparationAction,
  uploadMaterialAction,
} from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MatchExplanation } from "./MatchExplanation";
import { MaterialReview } from "./MaterialReview";
import { DraftReview } from "./DraftReview";
import {
  ActionError,
  Field,
  Section,
  selectClass,
  useCareerAction,
  type Workspace,
  type PreparationData,
} from "./shared";

export function Preparation({
  workspace,
  jobId,
  onSelect,
  onChanged,
}: {
  workspace: Workspace;
  jobId: string;
  onSelect: (id: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [data, setData] = useState<PreparationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [useAi, setUseAi] = useState(false);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [consent, setConsent] = useState(false);
  const modelReady = !useAi || (!!model.trim() && consent);
  const modelOptions = useAi
    ? { ai: { provider, model: model.trim(), consent: true } }
    : {};
  const { run, busy, error } = useCareerAction(onChanged);
  const latestRun = workspace.runs.find((item) => item.jobId === jobId);
  const selectedJob = workspace.jobs.find((job) => job.id === jobId);
  const confirmedEvidence = workspace.evidence.filter(
    (item) => item.status === "confirmed",
  );
  const needsAttach = selectedJob?.preparationStatus === "not_started";
  const active = workspace.runs.some(
    (item) =>
      item.jobId === jobId && ["queued", "running"].includes(item.status),
  );

  useEffect(() => {
    let cancelled = false;
    if (!jobId || needsAttach) {
      setData(null);
      return;
    }
    setLoading(true);
    setLoadError("");
    getPreparationAction(jobId)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setData(result.data);
        else {
          setData(null);
          setLoadError(`${result.error.message}（${result.error.code}）`);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("加载岗位准备信息失败，请重试。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jobId, needsAttach, workspace]);

  useEffect(() => {
    setSelectedEvidence([]);
  }, [jobId]);
  const current = data?.id === jobId ? data : null;
  const draft = current?.drafts[0];

  return (
    <div className="space-y-6">
      <Section
        title="岗位准备"
        description="选择岗位，核对资格与证据，再生成并审核投递材料。"
      >
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="当前岗位">
            <select
              className={selectClass}
              value={jobId}
              onChange={(event) => onSelect(event.target.value)}
            >
              <option value="">选择一个岗位</option>
              {workspace.jobs.map((job) => (
                <option key={job.id} value={job.id}>
                  {job.company} · {job.title}
                </option>
              ))}
            </select>
          </Field>
          {jobId && (
            <Button variant="outline" asChild>
              <a href={`/dashboard/myjobs/${jobId}`}>
                岗位详情
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
        <ActionError
          message={
            error ||
            loadError ||
            (latestRun?.status === "failed"
              ? `最近任务失败（${latestRun.errorCode ?? "UNKNOWN"}）。请检查输入后重试；PDF 编译失败时也可上传已有文件。`
              : "")
          }
        />
        {!jobId && (
          <p className="py-3 text-sm text-muted-foreground">
            先导入岗位，或选择已有岗位开始准备。
          </p>
        )}
        {needsAttach && (
          <Button
            disabled={busy}
            onClick={() => void run(() => attachJobAction(jobId))}
          >
            为此岗位启用 CareerOS
          </Button>
        )}
        {loading && !current && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载…
          </p>
        )}
        {current && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={busy || active || !modelReady}
              onClick={() =>
                void run(() =>
                  enqueueAction(
                    jobId,
                    "match",
                    modelOptions,
                    crypto.randomUUID(),
                  ),
                )
              }
            >
              分析岗位匹配
            </Button>
            {active && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                任务处理中，结果自动更新
              </p>
            )}
          </div>
        )}
      </Section>
      {current && (
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <div className="space-y-6">
            {current.analysis && (
              <MatchExplanation
                analysis={current.analysis}
                stale={current.analysisStale}
              />
            )}
            <Section
              title="选择简历素材"
              description="仅从已确认事实生成。默认保留事实原文；可选择已配置的模型协助改写。"
            >
              {confirmedEvidence.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  请先在「事实库」确认至少一条经历。
                </p>
              )}
              {confirmedEvidence.map((evidence) => (
                <label
                  key={evidence.evidenceKey}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="mt-1 accent-primary"
                    checked={selectedEvidence.includes(evidence.evidenceKey)}
                    onChange={(event) =>
                      setSelectedEvidence((current) =>
                        event.target.checked
                          ? [...current, evidence.evidenceKey]
                          : current.filter(
                              (key) => key !== evidence.evidenceKey,
                            ),
                      )
                    }
                  />
                  <span>
                    <span className="font-medium">{evidence.title}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {evidence.facts.text}
                    </span>
                  </span>
                </label>
              ))}
              <p className="text-xs text-muted-foreground">
                未勾选时使用全部已确认事实。
              </p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={useAi}
                  onChange={(event) => {
                    setUseAi(event.target.checked);
                    setConsent(false);
                  }}
                />
                使用模型分析与改写
              </label>
              {useAi && (
                <div className="space-y-3 rounded-lg border p-4">
                  <Field label="模型服务">
                    <select
                      className={selectClass}
                      value={provider}
                      onChange={(event) => {
                        setProvider(event.target.value);
                        setConsent(false);
                      }}
                    >
                      <option value="openai">OpenAI</option>
                      <option value="ollama">Ollama</option>
                      <option value="deepseek">DeepSeek</option>
                      <option value="openrouter">OpenRouter</option>
                      <option value="gemini">Gemini</option>
                    </select>
                  </Field>
                  <Field label="模型名称">
                    <Input
                      value={model}
                      onChange={(event) => {
                        setModel(event.target.value);
                        setConsent(false);
                      }}
                      placeholder="填写已配置服务支持的模型名称"
                    />
                  </Field>
                  <label className="flex items-start gap-2 text-sm leading-6">
                    <input
                      className="mt-1.5"
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                    我同意将岗位描述与选定事实发送给此模型服务。
                  </label>
                </div>
              )}
              <Button
                disabled={
                  busy ||
                  active ||
                  confirmedEvidence.length === 0 ||
                  !modelReady
                }
                onClick={() =>
                  void run(() =>
                    enqueueAction(
                      jobId,
                      "tailor",
                      {
                        ...(selectedEvidence.length
                          ? { evidenceKeys: selectedEvidence }
                          : {}),
                        ...modelOptions,
                      },
                      crypto.randomUUID(),
                    ),
                  )
                }
              >
                生成简历草稿
              </Button>
            </Section>
            <details className="rounded-xl border p-5">
              <summary className="cursor-pointer font-medium">
                岗位描述原文
              </summary>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-7 text-muted-foreground">
                {current.rawJd}
              </pre>
            </details>
          </div>
          <div className="space-y-6">
            {draft && (
              <DraftReview
                key={draft.id}
                draft={draft.draft}
                busy={busy || active}
                onCompile={(bullets, contact) =>
                  void run(() =>
                    acceptDraftAction(
                      draft.id,
                      bullets,
                      contact,
                      crypto.randomUUID(),
                    ),
                  )
                }
                onUpload={(bullets, contact, file) => {
                  const form = new FormData();
                  form.set("runId", draft.id);
                  form.set("bullets", JSON.stringify(bullets));
                  form.set("contact", JSON.stringify(contact));
                  form.set("file", file);
                  form.set("key", crypto.randomUUID());
                  void run(() => uploadMaterialAction(form));
                }}
              />
            )}
            <MaterialReview
              key={jobId}
              jobId={jobId}
              materials={current.materials}
              onChanged={onChanged}
            />
          </div>
        </div>
      )}
    </div>
  );
}
