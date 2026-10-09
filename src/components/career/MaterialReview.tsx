"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { approveMaterialAction, createPlanAction } from "@/actions/career";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApplicationReview } from "./ApplicationReview";
import {
  ActionError,
  Section,
  useCareerAction,
  type ApplicationPlan,
  type PreparationData,
} from "./shared";

export function MaterialReview({
  jobId,
  materials,
  onChanged,
}: {
  jobId: string;
  materials: PreparationData["materials"];
  onChanged: () => Promise<void>;
}) {
  const [viewing, setViewing] = useState("");
  const [plan, setPlan] = useState<ApplicationPlan | null>(null);
  const { run, busy, error } = useCareerAction(onChanged);
  const viewingMaterial = materials.find((material) => material.id === viewing);
  return (
    <Section
      title="材料与投递计划"
      description="预览 PDF 后确认材料，再核对公司、届别与投递渠道。"
    >
      <ActionError message={error} />
      {materials.length === 0 && (
        <div className="flex gap-3 py-4 text-sm text-muted-foreground">
          <FileText className="h-5 w-5 shrink-0" />
          生成或上传 PDF 后，材料会显示在这里。
        </div>
      )}
      {materials.map((material) => (
        <article className="space-y-3 rounded-lg border p-3" key={material.id}>
          <div className="flex flex-wrap justify-between gap-2">
            <span className="text-sm font-medium">
              简历 PDF · {new Date(material.createdAt).toLocaleString("zh-CN")}
            </span>
            <Badge variant="outline">
              {material.approved ? "已复核" : "待复核"}
            </Badge>
          </div>
          <p className="break-all font-mono text-xs text-muted-foreground">
            {material.materialKey}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setViewing(material.id)}
            >
              预览材料
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <a
                href={`/api/career/materials/${material.id}/download`}
                target="_blank"
                rel="noreferrer"
              >
                打开 PDF
              </a>
            </Button>
            {material.approved && (
              <Button
                size="sm"
                disabled={busy}
                onClick={async () => {
                  const result = await run(() =>
                    createPlanAction(jobId, material.id),
                  );
                  if (result) {
                    setPlan(result);
                  }
                }}
              >
                生成投递计划
              </Button>
            )}
          </div>
        </article>
      ))}
      {viewingMaterial && (
        <div className="space-y-3">
          <iframe
            className="h-[480px] w-full rounded-lg border bg-white"
            title="简历 PDF 预览"
            src={`/api/career/materials/${viewingMaterial.id}/download`}
          />
          <p className="text-xs text-muted-foreground">
            请核对排版、姓名、联系方式及所有经历。若为自行上传的文件，需自行确保
            PDF 内容与已确认事实一致。
          </p>
          <Button
            disabled={busy || viewingMaterial.approved}
            onClick={() =>
              void run(() => approveMaterialAction(viewingMaterial.id))
            }
          >
            {viewingMaterial.approved ? "材料已确认" : "我已检查 PDF，确认材料"}
          </Button>
        </div>
      )}
      {plan && (
        <ApplicationReview key={plan.runId} plan={plan} onChanged={onChanged} />
      )}
    </Section>
  );
}
