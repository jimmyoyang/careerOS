"use client";
import { useTransition, useState, useEffect } from "react";
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
import { AddCompanyFormSchema } from "@/models/addCompanyForm.schema";
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
import { addCompany, updateCompany } from "@/actions/company.actions";
import { Company } from "@/models/job.model";

type AddCompanyProps = {
  reloadCompanies: () => void;
  editCompany?: Company | null;
  resetEditCompany: () => void;
  dialogOpen: boolean;
  setDialogOpen: (e: boolean) => void;
  hideTrigger?: boolean;
};

function AddCompany({
  reloadCompanies,
  editCompany,
  resetEditCompany,
  dialogOpen,
  setDialogOpen,
  hideTrigger,
}: AddCompanyProps) {
  const [isPending, startTransition] = useTransition();

  const pageTitle = editCompany ? "编辑公司" : "添加公司";

  const form = useForm<z.infer<typeof AddCompanyFormSchema>>({
    resolver: zodResolver(AddCompanyFormSchema),
    defaultValues: {
      company: "",
      logoUrl: "",
      websiteUrl: "",
      careersUrl: "",
      industry: "",
      id: undefined,
      createdBy: undefined,
    },
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (editCompany) {
      reset(
        {
          id: editCompany?.id,
          company: editCompany?.label ?? "",
          createdBy: editCompany?.createdBy,
          logoUrl: editCompany?.logoUrl ?? "",
          websiteUrl: editCompany?.websiteUrl ?? "",
          careersUrl: editCompany?.careersUrl ?? "",
          industry: editCompany?.industry ?? "",
        },
        { keepDefaultValues: true },
      );
    }
  }, [editCompany, reset]);

  const addCompanyForm = () => {
    if (!editCompany) {
      reset();
      resetEditCompany();
    }
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const onSubmit = (data: z.infer<typeof AddCompanyFormSchema>) => {
    startTransition(async () => {
      const res = editCompany
        ? await updateCompany(data)
        : await addCompany(data);
      toastActionResult(res, {
        success: `公司已${editCompany ? "更新" : "创建"}`,
        onSuccess: () => {
          reset();
          setDialogOpen(false);
          reloadCompanies();
        },
      });
    });
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          onClick={addCompanyForm}
          data-testid="add-company-btn"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            新建公司
          </span>
        </Button>
      )}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="lg:max-h-screen overflow-y-scroll">
          <DialogHeader>
            <DialogTitle>{pageTitle}</DialogTitle>
            {editCompany && (
              <DialogDescription className="text-orange-600 dark:text-orange-500">
                注意：修改公司名称会影响所有相关职位记录，包括简历中的记录。
              </DialogDescription>
            )}
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
            >
              {/* COMPANY NAME */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>公司名称</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* COMPANY LOGO URL */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="logoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>公司标志链接</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {/* COMPANY WEBSITE */}
              <FormField
                control={form.control}
                name="websiteUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>网站</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* CAREERS PAGE */}
              <FormField
                control={form.control}
                name="careersUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>招聘页面</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="https://example.com/careers"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* INDUSTRY */}
              <div className="md:col-span-2">
                <FormField
                  control={form.control}
                  name="industry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>行业</FormLabel>
                      <FormControl>
                        <Input placeholder="金融服务" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="md:col-span-2 mt-4">
                <DialogFooter
                // className="md:col-span
                >
                  <div>
                    <Button
                      type="reset"
                      variant="outline"
                      className="mt-2 md:mt-0 w-full"
                      onClick={closeDialog}
                    >
                      取消
                    </Button>
                  </div>
                  <Button type="submit" disabled={!formState.isDirty}>
                    保存
                    {isPending && (
                      <Loader className="h-4 w-4 shrink-0 spinner" />
                    )}
                  </Button>
                </DialogFooter>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default AddCompany;
