import { format } from "date-fns";
import { toastError, toastSuccess } from "@/lib/toast";

export async function downloadJobsList() {
  try {
    const res = await fetch("/api/jobs/export", {
      method: "POST",
      headers: {
        "Content-Type": "text/csv",
      },
    });
    if (!res.ok) {
      throw new Error("下载职位失败！");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `jobsync-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toastSuccess("下载成功！");
  } catch (error) {
    toastError(
      error instanceof Error ? error.message : "发生未知错误。",
    );
  }
}
