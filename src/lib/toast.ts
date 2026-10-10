import { zhMessage } from "@/lib/i18n/zh-CN";
import { toast } from "sonner";
import type { ActionResult } from "@/models/action.model";

export function toastSuccess(message: string, title?: string) {
  if (title) toast.success(zhMessage(title), { description: zhMessage(message) });
  else toast.success(zhMessage(message));
}

export function toastError(message?: string, title?: string) {
  const text = message ?? "Something went wrong. Please try again.";
  if (title) toast.error(zhMessage(title), { description: zhMessage(text) });
  else toast.error(zhMessage(text));
}

// For outcomes that are neither: a deliberate interruption is not an error.
export function toastInfo(message: string, title?: string) {
  if (title) toast.info(zhMessage(title), { description: zhMessage(message) });
  else toast.info(zhMessage(message));
}

// Collapses the repeated success/error branch into one call.
export function toastActionResult<T>(
  result: ActionResult<T> | undefined,
  opts: { success: string; onSuccess?: (data: T | undefined) => void; error?: string },
) {
  if (result?.success) {
    toastSuccess(opts.success);
    opts.onSuccess?.(result.data);
  } else {
    toastError(result?.message ?? opts.error);
  }
}
