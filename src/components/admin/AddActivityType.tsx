"use client";
import { useTransition, useState } from "react";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Loader, PlusCircle } from "lucide-react";
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
import { toastSuccess, toastError } from "@/lib/toast";
import { createActivityType } from "@/actions/activity.actions";

const AddActivityTypeFormSchema = z.object({
  label: z
    .string({ error: "请输入活动类型名称。" })
    .min(1, { message: "活动类型名称不能为空。" })
    .max(60, {
      message: "活动类型名称不能超过 60 个字符。",
    }),
});

type AddActivityTypeProps = {
  reloadActivityTypes: () => void;
};

function AddActivityType({ reloadActivityTypes }: AddActivityTypeProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof AddActivityTypeFormSchema>>({
    resolver: zodResolver(AddActivityTypeFormSchema),
    defaultValues: { label: "" },
  });

  const { reset } = form;

  const openDialog = () => {
    reset();
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof AddActivityTypeFormSchema>) => {
    startTransition(async () => {
      try {
        await createActivityType(values.label);
        toastSuccess("活动类型已添加。");
        setDialogOpen(false);
        reset();
        reloadActivityTypes();
      } catch {
        toastError("创建活动类型失败。");
      }
    });
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        onClick={openDialog}
      >
        <PlusCircle className="h-3.5 w-3.5" />
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          新建活动类型
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加活动类型</DialogTitle>
            <DialogDescription>
              添加活动类型，用于分类活动和任务。
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>活动类型名称</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="例如：拓展人脉、面试准备"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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
    </>
  );
}

export default AddActivityType;
