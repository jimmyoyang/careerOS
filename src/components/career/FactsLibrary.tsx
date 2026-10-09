"use client";

import { useState } from "react";
import { reviseEvidenceAction, resumeCandidatesAction } from "@/actions/career";
import type { Facts } from "@/lib/career/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PreferencesForm } from "./PreferencesForm";
import { Badge } from "@/components/ui/badge";
import {
  ActionError,
  Field,
  Section,
  selectClass,
  statusLabel,
  useCareerAction,
  type Evidence,
  type Workspace,
} from "./shared";

type EvidenceKind = Parameters<typeof reviseEvidenceAction>[0]["kind"];
type Candidate = { kind: string; title: string; facts: Facts; source: string };
const emptyFact = {
  kind: "project",
  title: "",
  text: "",
  tags: "",
  protectedValues: "",
  source: "",
};
const splitValues = (value: string) =>
  value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

export function FactsLibrary({
  workspace,
  onChanged,
}: {
  workspace: Workspace;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<Evidence | null>(null);
  const [fact, setFact] = useState(emptyFact);
  const [resumeId, setResumeId] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [message, setMessage] = useState("");
  const { run, busy, error } = useCareerAction(onChanged);
  const edit = (evidence: Evidence) => {
    setEditing(evidence);
    setFact({
      kind: evidence.kind,
      title: evidence.title,
      text: evidence.facts.text,
      tags: evidence.facts.tags.join("，"),
      protectedValues: evidence.facts.protectedValues.join("，"),
      source: evidence.source,
    });
  };
  const save = async (status: "draft" | "confirmed") => {
    const result = await run(() =>
      reviseEvidenceAction({
        evidenceKey: editing?.evidenceKey,
        expectedRevision: editing?.revision,
        kind: fact.kind as EvidenceKind,
        title: fact.title,
        facts: {
          schemaVersion: 1,
          text: fact.text,
          tags: splitValues(fact.tags),
          protectedValues: splitValues(fact.protectedValues),
        },
        status,
        source: fact.source,
      }),
    );
    if (result !== undefined) {
      setEditing(null);
      setFact(emptyFact);
      setMessage(
        status === "confirmed"
          ? "事实已确认，可用于岗位材料。"
          : "草稿已保存。确认后才会参与材料生成。",
      );
    }
  };
  return (
    <div className="space-y-6">
      <ActionError message={error} />
      {message && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {message}
        </p>
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-6">
          <Section
            title={
              editing
                ? `修订事实 · 第 ${editing.revision + 1} 版`
                : "添加真实经历"
            }
            description="只有已确认的事实参与生成。金额、人数、日期等关键值会被保护；事实修改会保留版本。"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="事实标题">
                <Input
                  value={fact.title}
                  onChange={(event) =>
                    setFact({ ...fact, title: event.target.value })
                  }
                />
              </Field>
              <Field label="经历类型">
                <select
                  className={selectClass}
                  value={fact.kind}
                  onChange={(event) =>
                    setFact({ ...fact, kind: event.target.value })
                  }
                >
                  <option value="project">项目</option>
                  <option value="experience">工作 / 实习</option>
                  <option value="education">教育</option>
                  <option value="skill">技能</option>
                  <option value="other">其他</option>
                </select>
              </Field>
            </div>
            <Field label="事实原文">
              <Textarea
                className="min-h-32"
                value={fact.text}
                onChange={(event) =>
                  setFact({ ...fact, text: event.target.value })
                }
                placeholder="描述你实际完成的工作、使用的方法及可核实的结果。"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="技能标签（逗号分隔）">
                <Input
                  value={fact.tags}
                  onChange={(event) =>
                    setFact({ ...fact, tags: event.target.value })
                  }
                />
              </Field>
              <Field label="保护值（逗号分隔）">
                <Input
                  value={fact.protectedValues}
                  onChange={(event) =>
                    setFact({ ...fact, protectedValues: event.target.value })
                  }
                />
              </Field>
            </div>
            <Field label="事实来源">
              <Input
                value={fact.source}
                onChange={(event) =>
                  setFact({ ...fact, source: event.target.value })
                }
                placeholder="如项目记录、原始简历或个人确认"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !fact.title.trim() || !fact.text.trim()}
                onClick={() => void save("confirmed")}
              >
                确认事实并保存
              </Button>
              <Button
                variant="outline"
                disabled={busy || !fact.title.trim() || !fact.text.trim()}
                onClick={() => void save("draft")}
              >
                存为草稿
              </Button>
              {editing && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(null);
                    setFact(emptyFact);
                  }}
                >
                  取消编辑
                </Button>
              )}
            </div>
          </Section>
          <Section
            title="事实库"
            description={`${workspace.evidence.filter((item) => item.status === "confirmed").length} 条已确认事实`}
          >
            {workspace.evidence.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">
                还没有事实。添加一段经历，或从已有简历提取候选。
              </p>
            )}
            {workspace.evidence.map((evidence) => (
              <article
                className="space-y-3 rounded-xl border p-4"
                key={evidence.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-medium">{evidence.title}</h3>
                  <Badge
                    variant={
                      evidence.status === "confirmed" ? "secondary" : "outline"
                    }
                  >
                    {statusLabel(evidence.status)} · v{evidence.revision}
                  </Badge>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6">
                  {evidence.facts.text}
                </p>
                <div className="flex flex-wrap gap-1">
                  {evidence.facts.tags.map((tag) => (
                    <Badge variant="outline" key={tag}>
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => edit(evidence)}
                  >
                    修订
                  </Button>
                  {evidence.status !== "withdrawn" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(() =>
                          reviseEvidenceAction({
                            ...evidence,
                            kind: evidence.kind as EvidenceKind,
                            expectedRevision: evidence.revision,
                            status: "withdrawn",
                          }),
                        )
                      }
                    >
                      撤回
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </Section>
        </div>
        <div className="space-y-6">
          <PreferencesForm
            initialPreferences={workspace.preferences}
            onChanged={onChanged}
          />
          <Section
            title="从已有简历提取候选"
            description="先预览内容，再逐条确认。简历原文不会自动成为已确认事实。"
          >
            <Field label="选择简历">
              <select
                className={selectClass}
                value={resumeId}
                onChange={(event) => setResumeId(event.target.value)}
              >
                <option value="">请选择</option>
                {workspace.resumes.map((resume) => (
                  <option key={resume.id} value={resume.id}>
                    {resume.title}
                  </option>
                ))}
              </select>
            </Field>
            <Button
              variant="outline"
              disabled={busy || !resumeId}
              onClick={async () => {
                const result = await run(() =>
                  resumeCandidatesAction(resumeId),
                );
                if (result) {
                  setCandidates(result);
                  if (!result.length) setMessage("这份简历没有可提取的经历。");
                }
              }}
            >
              预览候选事实
            </Button>
            {candidates.map((candidate, index) => (
              <article className="space-y-3 rounded-lg border p-3" key={index}>
                <h3 className="text-sm font-medium">{candidate.title}</h3>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {candidate.facts.text}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={async () => {
                      const result = await run(() =>
                        reviseEvidenceAction({
                          ...candidate,
                          kind: candidate.kind as EvidenceKind,
                          status: "confirmed",
                        }),
                      );
                      if (result !== undefined)
                        setCandidates((current) =>
                          current.filter((_, i) => i !== index),
                        );
                    }}
                  >
                    确认此条事实
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setCandidates((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    忽略
                  </Button>
                </div>
              </article>
            ))}
          </Section>
        </div>
      </div>
    </div>
  );
}
