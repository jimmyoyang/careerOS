"use client";

import { useState } from "react";
import { FileUp, Plus, Search } from "lucide-react";
import { importDomesticJobAction, importJobAction, parseTableAction, searchDomesticJobsAction } from "@/actions/career";
import type { ImportInput } from "@/lib/career/contracts";
import { domesticJobToImport, domesticPostingKey, domesticSource, type DomesticJob, type DomesticProvider } from "@/lib/domestic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ActionError,
  Field,
  Section,
  selectClass,
  useCareerAction,
} from "./shared";

const emptyJob: ImportInput = {
  company: "",
  title: "",
  rawJd: "",
  location: "",
  url: "",
  platform: "unknown",
  recruitmentType: "unknown",
  cohort: "",
  postingId: "",
  dueDate: "",
  referral: "",
};

function JobFields({
  value,
  onChange,
  prefix = "",
}: {
  value: ImportInput;
  onChange: (value: ImportInput) => void;
  prefix?: string;
}) {
  const update = (key: keyof ImportInput, text: string) =>
    onChange({ ...value, [key]: text });
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["company", "公司 *"],
            ["title", "岗位名称 *"],
            ["location", "工作地点"],
            ["url", "原始链接"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={prefix + label}>
            <Input
              value={value[key] ?? ""}
              onChange={(event) => update(key, event.target.value)}
              required={key === "company" || key === "title"}
              type={key === "url" ? "url" : "text"}
            />
          </Field>
        ))}
        <Field label={prefix + "招聘平台"}>
          <select
            className={selectClass}
            value={value.platform}
            onChange={(event) => update("platform", event.target.value)}
          >
            <option value="unknown">未知</option>
            <option value="huawei">华为</option>
            <option value="bytedance">字节跳动</option>
            <option value="tencent">腾讯</option>
            <option value="alibaba">阿里巴巴</option>
            <option value="meituan">美团</option>
            <option value="other">其他</option>
          </select>
        </Field>
        <Field label={prefix + "招聘类型"}>
          <select
            className={selectClass}
            value={value.recruitmentType}
            onChange={(event) => update("recruitmentType", event.target.value)}
          >
            <option value="unknown">未知</option>
            <option value="campus">校园招聘</option>
            <option value="internship">实习</option>
            <option value="experienced">社会招聘</option>
          </select>
        </Field>
      </div>
      <Field label={prefix + "岗位描述原文 *"}>
        <Textarea
          className="min-h-44"
          required
          value={value.rawJd}
          placeholder="完整粘贴岗位职责、任职要求及招聘说明，保留原文。"
          onChange={(event) => update("rawJd", event.target.value)}
        />
      </Field>
      <details className="rounded-lg border p-3">
        <summary className="cursor-pointer text-sm font-medium">
          补充招聘信息
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["cohort", "招聘届别"],
              ["postingId", "岗位编号"],
              ["dueDate", "截止日期"],
              ["referral", "内推信息"],
            ] as const
          ).map(([key, label]) => (
            <Field label={prefix + label} key={key}>
              <Input
                value={value[key] ?? ""}
                type={key === "dueDate" ? "date" : "text"}
                onChange={(event) => update(key, event.target.value)}
              />
            </Field>
          ))}
        </div>
      </details>
    </div>
  );
}

export function ImportJobs({
  onChanged,
  onImported,
}: {
  onChanged: () => Promise<void>;
  onImported: (jobId: string) => void;
}) {
  const [job, setJob] = useState<ImportInput>(emptyJob);
  const [table, setTable] = useState("");
  const [rows, setRows] = useState<ImportInput[]>([]);
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(false);
  const { run, busy: actionBusy, error } = useCareerAction(onChanged);
  const [batchBusy, setBatchBusy] = useState(false);
  const [domesticProvider, setDomesticProvider] = useState<DomesticProvider>("tencent");
  const [domesticKeyword, setDomesticKeyword] = useState("");
  const [domesticJobs, setDomesticJobs] = useState<DomesticJob[]>([]);
  const [domesticTotal, setDomesticTotal] = useState(0);
  const [domesticPage, setDomesticPage] = useState(1);
  const [domesticBusy, setDomesticBusy] = useState(false);
  const [domesticError, setDomesticError] = useState("");
  const busy = actionBusy || batchBusy;
  const searchDomestic = async (page = 1) => {
    setDomesticBusy(true);
    setDomesticError("");
    const result = await searchDomesticJobsAction(domesticProvider, domesticKeyword, page);
    if (result.ok) {
      setDomesticJobs(result.data.jobs);
      setDomesticTotal(result.data.total);
      setDomesticPage(page);
    } else setDomesticError(result.error.message);
    setDomesticBusy(false);
  };
  const importDomestic = async (item: DomesticJob) => {
    const input = domesticJobToImport(item);
    const result = await run(() => importDomesticJobAction(input, crypto.randomUUID(), domesticPostingKey(item), domesticSource(item)));
    if (result) {
      setMessage(result.duplicate ? "该公开岗位已存在，已关联来源。" : "公开岗位已导入。");
      onImported(result.jobId);
    }
  };
  const importOne = async () => {
    const result = await run(() => importJobAction(job, crypto.randomUUID()));
    if (result) {
      setMessage(result.duplicate ? "已定位到已有岗位。" : "岗位已导入。");
      onImported(result.jobId);
    }
  };
  const importRows = async () => {
    setBatchBusy(true);
    let completed = 0;
    for (const row of rows) {
      const result = await run(() => importJobAction(row, crypto.randomUUID()));
      if (!result) break;
      completed++;
    }
    setBatchBusy(false);
    setRows((current) => current.slice(completed));
    setMessage(`已处理 ${completed} 条岗位。未成功的条目会保留在预览中。`);
  };

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
      <Section
        title="国内大厂公开岗位"
        description="从腾讯、阿里巴巴、美团公开招聘站搜索岗位，确认后写入 CareerOS。系统按平台和公开岗位编号去重。"
      >
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto]">
          <select className={selectClass} value={domesticProvider} onChange={(event) => setDomesticProvider(event.target.value as DomesticProvider)}>
            <option value="tencent">腾讯</option>
            <option value="alibaba">阿里巴巴</option>
            <option value="meituan">美团</option>
          </select>
          <Input value={domesticKeyword} placeholder="例如：后端、算法、产品经理" onChange={(event) => setDomesticKeyword(event.target.value)} />
          <Button type="button" disabled={domesticBusy || !domesticKeyword.trim()} onClick={() => void searchDomestic()}>
            <Search className="h-4 w-4" />搜索
          </Button>
        </div>
        {domesticError && <ActionError message={domesticError} />}
        {domesticJobs.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">共 {domesticTotal} 个岗位，本页显示 {domesticJobs.length} 个</p>
            {domesticJobs.map((item) => (
              <article key={`${item.platform}:${item.postingId}`} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <h3 className="font-medium">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.company} · {item.location || "地点未知"}</p>
                  </div>
                  <Button type="button" size="sm" disabled={busy} onClick={() => void importDomestic(item)}>导入 CareerOS</Button>
                </div>
                <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{item.description || "暂无岗位描述"}</p>
                <a className="mt-2 inline-block text-xs text-primary underline" href={item.sourceUrl || item.url} target="_blank" rel="noreferrer">查看官方来源</a>
              </article>
            ))}
            <div className="flex items-center justify-between gap-3 text-sm">
              <Button type="button" variant="outline" size="sm" disabled={domesticBusy || domesticPage <= 1} onClick={() => void searchDomestic(domesticPage - 1)}>上一页</Button>
              <span>第 {domesticPage} 页</span>
              <Button type="button" variant="outline" size="sm" disabled={domesticBusy || domesticJobs.length === 0 || domesticPage * 10 >= domesticTotal} onClick={() => void searchDomestic(domesticPage + 1)}>下一页</Button>
            </div>
          </div>
        )}
      </Section>
      <Section
        title="导入一份岗位描述"
        description="从原始招聘信息开始。未知项可以留空，系统不会补造截止日期或任职条件。"
      >
        <ActionError message={error} />
        {message && (
          <p
            role="status"
            className="text-sm text-emerald-700 dark:text-emerald-400"
          >
            {message}
          </p>
        )}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPreview(true);
          }}
        >
          <JobFields
            value={job}
            onChange={(value) => {
              setJob(value);
              setPreview(false);
            }}
          />
          {!preview ? (
            <Button disabled={busy} type="submit">
              <Plus className="mr-2 h-4 w-4" />
              预览导入
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-4">
              <h3 className="font-medium">
                {job.company} · {job.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {job.location || "地点未知"} · 截止日期 {job.dueDate || "未知"}
              </p>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap font-sans text-sm leading-6">
                {job.rawJd}
              </pre>
              <Button
                type="button"
                disabled={busy}
                onClick={() => void importOne()}
              >
                确认导入岗位
              </Button>
            </div>
          )}
        </form>
      </Section>
      <Section
        title="批量导入表格"
        description="支持 CSV 或从表格复制的 TSV。表头使用 company、title、rawJd；可附 location、url 等字段。解析后逐行核对和修改。"
      >
        <Field label="CSV / TSV 文件">
          <Input
            type="file"
            accept=".csv,.tsv,text/csv,text/tab-separated-values"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (file) setTable(await file.text());
            }}
          />
        </Field>
        <Field label="表格文本">
          <Textarea
            className="min-h-36 font-mono text-xs"
            value={table}
            onChange={(event) => setTable(event.target.value)}
            placeholder="company,title,rawJd"
          />
        </Field>
        <Button
          variant="outline"
          disabled={busy || !table.trim()}
          onClick={async () => {
            const parsed = await run(() => parseTableAction(table));
            if (parsed) setRows(parsed);
          }}
        >
          <FileUp className="mr-2 h-4 w-4" />
          解析并预览
        </Button>
        {rows.map((row, index) => (
          <details
            className="rounded-lg border p-3"
            key={index}
            open={rows.length === 1}
          >
            <summary className="cursor-pointer text-sm font-medium">
              {index + 1}. {row.company} · {row.title}
            </summary>
            <div className="mt-4 space-y-3">
              <JobFields
                prefix={`第 ${index + 1} 行 · `}
                value={row}
                onChange={(value) =>
                  setRows((current) =>
                    current.map((item, i) => (i === index ? value : item)),
                  )
                }
              />
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setRows((current) => current.filter((_, i) => i !== index))
                }
              >
                移除此行
              </Button>
            </div>
          </details>
        ))}
        {rows.length > 0 && (
          <Button disabled={busy} onClick={() => void importRows()}>
            导入已核对的 {rows.length} 条岗位
          </Button>
        )}
      </Section>
    </div>
  );
}
