"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Bullet, Draft } from "@/lib/career/contracts";
import { Field, Section } from "./shared";

type Contact = { name: string; email: string; phone: string };
type Props = {
  draft: Draft;
  busy: boolean;
  onCompile: (bullets: Bullet[], contact: Contact) => void;
  onUpload: (bullets: Bullet[], contact: Contact, file: File) => void;
};

export function DraftReview({ draft, busy, onCompile, onUpload }: Props) {
  const [bullets, setBullets] = useState(draft.bullets);
  const [contact, setContact] = useState<Contact>({
    name: "",
    email: "",
    phone: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const ready =
    contact.name.trim() &&
    bullets.every((b) => b.verification !== "needs_review") &&
    bullets.some((b) => b.verification === "accepted");
  const update = (index: number, patch: Partial<Bullet>) =>
    setBullets((current) =>
      current.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    );

  return (
    <Section
      title="逐条复核简历"
      description="核对原始事实与建议表述。修改后需重新采纳；所有条目处理完毕后才能生成材料。"
    >
      <div className="flex items-center justify-between gap-3">
        <Badge variant="outline">{draft.model}</Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setBullets((current) =>
              current.map((b) => ({ ...b, verification: "accepted" })),
            )
          }
        >
          全部采纳
        </Button>
      </div>
      {bullets.map((bullet, index) => (
        <article
          className="space-y-3 rounded-xl border p-4"
          key={bullet.bulletKey}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                原始事实
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6">
                {bullet.original}
              </p>
            </div>
            <Field label={`建议表述 ${index + 1}`}>
              <Textarea
                value={bullet.proposed}
                onChange={(event) =>
                  update(index, {
                    proposed: event.target.value,
                    verification: "needs_review",
                  })
                }
              />
            </Field>
          </div>
          <p className="text-xs leading-5 text-muted-foreground">
            调整依据：{bullet.reason}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={
                bullet.verification === "accepted" ? "default" : "outline"
              }
              onClick={() => update(index, { verification: "accepted" })}
            >
              采纳此条
            </Button>
            <Button
              size="sm"
              variant={
                bullet.verification === "rejected" ? "secondary" : "ghost"
              }
              onClick={() => update(index, { verification: "rejected" })}
            >
              舍弃此条
            </Button>
            <span className="text-xs text-muted-foreground">
              {bullet.verification === "needs_review"
                ? "待复核"
                : bullet.verification === "accepted"
                  ? "已采纳"
                  : "已舍弃"}
            </span>
          </div>
        </article>
      ))}
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["name", "姓名"],
            ["email", "邮箱"],
            ["phone", "电话"],
          ] as const
        ).map(([key, label]) => (
          <Field label={label} key={key}>
            <Input
              value={contact[key]}
              type={key === "email" ? "email" : "text"}
              onChange={(event) =>
                setContact({ ...contact, [key]: event.target.value })
              }
            />
          </Field>
        ))}
      </div>
      <Button
        disabled={busy || !ready}
        onClick={() => onCompile(bullets, contact)}
      >
        生成 PDF
      </Button>
      <details className="rounded-lg border p-3 text-sm">
        <summary className="cursor-pointer font-medium">
          编译不可用时，上传已排版的 PDF
        </summary>
        <div className="mt-3 space-y-3">
          <p className="text-muted-foreground">
            上传前同样需要完成事实复核。上传成功后请预览并确认文件。
          </p>
          <Input
            aria-label="简历 PDF"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <Button
            variant="outline"
            disabled={busy || !ready || !file}
            onClick={() => file && onUpload(bullets, contact, file)}
          >
            上传 PDF
          </Button>
        </div>
      </details>
    </Section>
  );
}
