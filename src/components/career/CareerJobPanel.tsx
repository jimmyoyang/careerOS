import Link from "next/link";
import { ArrowUpRight, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Section } from "./shared";

export function CareerJobPanel({ jobId }: { jobId: string }) {
  return (
    <Section
      title="CareerOS 岗位准备"
      description="使用已确认事实核对岗位要求，复核简历修改，生成专属 PDF 并记录实际投递。"
    >
      <div className="flex items-start gap-3 rounded-lg bg-muted/40 p-4">
        <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="text-sm leading-6 text-muted-foreground">
          材料生成、人工复核和投递记录在工作台中连续完成；每一项修改都可以追溯到原始经历。
        </p>
      </div>
      <Button asChild>
        <Link href={`/dashboard/career?jobId=${jobId}`}>
          打开岗位准备
          <ArrowUpRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </Section>
  );
}
