"use client";
import { useTransition, useEffect } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Loader } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import SelectFormCtrl from "../Select";
import { toastActionResult } from "@/lib/toast";
import { JobStageTypeRef } from "@/models/jobStage.model";
import { JobStatus } from "@/models/job.model";
import {
  createJobStageType,
  updateJobStageType,
} from "@/actions/jobStageType.actions";

const AddJobStageTypeFormSchema = z.object({
  label: z
    .string({ error: "请输入阶段名称。" })
    .min(1, { message: "阶段名称不能为空。" })
    .max(80, { message: "阶段名称不能超过 80 个字符。" }),
  statusId: z
    .string({ error: "请选择所属状态。" })
    .min(1, { message: "请选择该阶段对应的状态。" }),
});

type AddJobStageTypeProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: JobStageTypeRef | null;
  statuses: JobStatus[];
  reloadTypes: () => void;
};

function AddJobStageType({
  open,
  onOpenChange,
  type,
  statuses,
  reloadTypes,
}: AddJobStageTypeProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof AddJobStageTypeFormSchema>>({
    resolver: zodResolver(AddJobStageTypeFormSchema),
    defaultValues: { label: "", statusId: "" },
  });

  const { reset } = form;

  // A custom stage is most often an interview round, so that is the default.
  useEffect(() => {
    if (!open) return;
    reset({
      label: type?.label ?? "",
      statusId:
        type?.statusId ??
        statuses.find((s) => s.value === "interview")?.id ??
        "",
    });
  }, [open, type, statuses, reset]);

  const onSubmit = (values: z.infer<typeof AddJobStageTypeFormSchema>) => {
    startTransition(async () => {
      const res = type
        ? await updateJobStageType(
            type.id,
            values.label,
            values.statusId,
            type.sortOrder,
          )
        : await createJobStageType(values.label, values.statusId);
      toastActionResult(res, {
        success: `阶段已${type ? "更新" : "添加"}。`,
        onSuccess: () => {
          onOpenChange(false);
          reset();
          reloadTypes();
        },
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {type ? "编辑阶段" : "添加阶段"}
          </DialogTitle>
          <DialogDescription>
            阶段记录求职流程中的各个步骤。每个阶段对应一种状态，成为当前阶段后会同步更新职位状态。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>阶段名称</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例如：课后测试"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="statusId"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>所属状态</FormLabel>
                  <SelectFormCtrl
                      translateOptions
                    label="状态"
                    options={statuses}
                    field={field}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={isPending}>
                保存
                {isPending && (
                  <Loader className="ml-2 h-4 w-4 shrink-0 spinner" />
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddJobStageType;
