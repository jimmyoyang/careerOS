import { Clock } from "lucide-react";

export const SlowResponseWarning = () => (
  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-sm mt-3 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-200 dark:border-amber-800 animate-in fade-in duration-500">
    <Clock className="h-4 w-4 shrink-0" />
    <span>
      模型响应比平时慢。你可以继续等待，或前往 <span className="font-medium">设置</span> 选择响应更快的模型。
    </span>
  </div>
);
