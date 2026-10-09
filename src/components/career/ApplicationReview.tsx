"use client";

import { useState } from "react";
import { recordApplicationAction } from "@/actions/career";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionError,
  Field,
  useCareerAction,
  type ApplicationPlan,
} from "./shared";

export function ApplicationReview({
  plan,
  onChanged,
}: {
  plan: ApplicationPlan;
  onChanged: () => Promise<void>;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [occurredAt, setOccurredAt] = useState("");
  const { run, busy, error } = useCareerAction(onChanged);
  return (
    <>
      <ActionError message={error} />
      <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
        <h3 className="font-medium">投递前核对</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          {Object.entries({
            公司: plan.summary.company,
            岗位: plan.summary.title,
            地点: plan.summary.location || "未知",
            届别: plan.summary.cohort || "未知",
            平台:
              (
                {
                  unknown: "未知",
                  huawei: "华为",
                  bytedance: "字节跳动",
                  other: "其他",
                } as Record<string, string>
              )[plan.summary.platform] ?? plan.summary.platform,
            内推信息: plan.summary.referral || "未填写",
          }).map(([label, value]) => (
            <div className="contents" key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="break-words">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm leading-6 text-amber-800 dark:text-amber-300">
          平台规则未知。请自行核实招聘网站对简历、重复投递和内推的要求，并在网站完成提交。
        </p>
        <p className="break-all text-xs text-muted-foreground">
          PDF 指纹：{plan.summary.pdfHash}
        </p>
        <Field label="实际投递时间">
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </Field>
        <label className="flex items-start gap-2 text-sm leading-6">
          <input
            className="mt-1.5"
            type="checkbox"
            checked={submitted}
            disabled={recorded}
            onChange={(event) => setSubmitted(event.target.checked)}
          />
          我已核对以上信息，并已在外部招聘网站实际提交。
        </label>
        <Button
          disabled={busy || !submitted || !occurredAt || recorded}
          onClick={async () => {
            const result = await run(() =>
              recordApplicationAction(
                plan.runId,
                plan.reviewHash,
                new Date(occurredAt).toISOString(),
                submitted,
              ),
            );
            if (result !== undefined) setRecorded(true);
          }}
        >
          {recorded ? "已记录投递" : "记录已完成的投递"}
        </Button>
      </div>
    </>
  );
}
