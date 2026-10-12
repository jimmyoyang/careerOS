import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="col-span-3 flex flex-col items-center justify-center py-24 text-center">
      <FileQuestion className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium">未找到</h3>
      <p className="text-muted-foreground mt-2">
        此页面不存在，或记录已被删除。
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/dashboard">返回工作台</Link>
      </Button>
    </div>
  );
}
