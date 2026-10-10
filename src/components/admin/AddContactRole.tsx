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
import { toastActionResult } from "@/lib/toast";
import { createContactRole } from "@/actions/contactRole.actions";

const AddContactRoleFormSchema = z.object({
  label: z
    .string({ error: "请输入角色名称。" })
    .min(1, { message: "角色名称不能为空。" })
    .max(60, { message: "角色名称不能超过 60 个字符。" }),
});

type AddContactRoleProps = {
  reloadRoles: () => void;
};

function AddContactRole({ reloadRoles }: AddContactRoleProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<z.infer<typeof AddContactRoleFormSchema>>({
    resolver: zodResolver(AddContactRoleFormSchema),
    defaultValues: { label: "" },
  });

  const { reset } = form;

  const openDialog = () => {
    reset();
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof AddContactRoleFormSchema>) => {
    startTransition(async () => {
      const res = await createContactRole(values.label);
      toastActionResult(res, {
        success: "角色已添加。",
        onSuccess: () => {
          setDialogOpen(false);
          reset();
          reloadRoles();
        },
      });
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
          新建角色
        </span>
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加联系人角色</DialogTitle>
            <DialogDescription>
              角色说明联系人在某个职位申请中的身份，例如招聘人员、面试官或推荐人。
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>角色名称</FormLabel>
                    <FormControl>
                      <Input placeholder="例如：面试组长、内推人" {...field} />
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

export default AddContactRole;
