"use client";
import { AddEducationFormSchema } from "@/models/AddEductionForm.schema";
import { Education, ResumeSection } from "@/models/profile.model";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { FormDialogFooter } from "../FormDialogFooter";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { DatePicker } from "../DatePicker";
import { Switch } from "../ui/switch";
import TiptapEditor from "../TiptapEditor";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toastSuccess, toastError } from "@/lib/toast";
import { Combobox } from "../ComboBox";
import { JobLocation } from "@/models/job.model";
import { addEducation, updateEducation } from "@/actions/profile.actions";
import { getAllJobLocations } from "@/actions/jobLocation.actions";

type AddEducationProps = {
  resumeId: string | undefined;
  sectionId: string | undefined;
  dialogOpen: boolean;
  setDialogOpen: (e: boolean) => void;
  educationToEdit?: ResumeSection;
};

function AddEducation({
  resumeId,
  sectionId,
  dialogOpen,
  setDialogOpen,
  educationToEdit,
}: AddEducationProps) {
  const pageTitle = educationToEdit ? "编辑教育经历" : "添加教育经历";
  const pageDescription = educationToEdit
    ? "更新简历中的这段教育经历。"
    : "向简历添加教育经历。";
  const [isPending, startTransition] = useTransition();
  const [locations, setLocations] = useState<JobLocation[]>([]);

  const getLocationData = useCallback(async () => {
    const _locations = await getAllJobLocations();
    setLocations(_locations);
  }, []);

  const form = useForm<z.infer<typeof AddEducationFormSchema>>({
    resolver: zodResolver(AddEducationFormSchema),
    defaultValues: {
      resumeId,
      sectionId,
      degreeCompleted: true,
      sectionTitle: "",
      institution: "",
      degree: "",
      fieldOfStudy: "",
    },
  });

  const { watch, reset, formState, resetField } = form;

  const degreeCompletedValue = watch("degreeCompleted");

  useEffect(() => {
    if (!dialogOpen) return;
    getLocationData();
    if (educationToEdit) {
      const education: Education = educationToEdit?.educations?.at(0)!;
      reset(
        {
          id: education?.id,
          institution: education?.institution,
          degree: education?.degree,
          fieldOfStudy: education?.fieldOfStudy,
          location: education?.location.id,
          startDate: education?.startDate,
          endDate: education?.endDate,
          description: education?.description,
          degreeCompleted: !!education?.endDate,
        },
        { keepDefaultValues: true },
      );
    } else {
      reset(
        {
          resumeId,
          sectionId,
          sectionTitle: "",
          institution: "",
          degree: "",
          fieldOfStudy: "",
        },
        { keepDefaultValues: true },
      );
    }
  }, [
    dialogOpen,
    getLocationData,
    educationToEdit,
    resumeId,
    sectionId,
    reset,
  ]);

  const onDegreeCompleted = (completed: boolean) => {
    if (completed) {
      resetField("endDate");
    }
  };

  const onSubmit = (data: z.infer<typeof AddEducationFormSchema>) => {
    startTransition(async () => {
      const res = educationToEdit?.educations?.length
        ? await updateEducation(data)
        : await addEducation(data);
      if (!res.success) {
        toastError(res.message);
      } else {
        reset();
        setDialogOpen(false);
        toastSuccess(`教育经历已${
          educationToEdit ? "更新" : "添加"
        }`);
      }
    });
  };

  const closeDialog = () => setDialogOpen(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="h-full md:h-[85%] lg:max-h-screen md:max-w-[40rem] overflow-y-scroll">
        <DialogHeader>
          <DialogTitle>{pageTitle}</DialogTitle>
          <DialogDescription>{pageDescription}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2"
          >
            {/* SECTION TITLE */}
            {!sectionId && (
              <>
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="sectionTitle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>模块标题</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="例如：教育经历" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <hr className="md:col-span-2" />
              </>
            )}

            {/* INSTITUTION */}
            <div>
              <FormField
                control={form.control}
                name="institution"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>学校</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：斯坦福大学" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* LOCATION */}
            <div>
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>地点</FormLabel>
                    <FormControl>
                      <Combobox options={locations!} field={field} creatable />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* DEGREE */}
            <div>
              <FormField
                control={form.control}
                name="degree"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>学位</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：学士" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {/* FIELD OF STUDY */}
            <div>
              <FormField
                control={form.control}
                name="fieldOfStudy"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>专业</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="例如：计算机科学" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* START DATE */}
            <div className="flex flex-col">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>开始日期</FormLabel>
                    <DatePicker
                      field={field}
                      presets={false}
                      isEnabled={true}
                      captionLayout={true}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* END DATE */}
            <div className="flex flex-col">
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>结束日期</FormLabel>
                    <DatePicker
                      field={field}
                      presets={false}
                      isEnabled={degreeCompletedValue!}
                      captionLayout={true}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* CURRENT STUDY */}
            <div className="flex items-center">
              <FormField
                control={form.control}
                name="degreeCompleted"
                render={({ field }) => (
                  <FormItem className="flex flex-row">
                    <Switch
                      checked={field.value}
                      onCheckedChange={(c) => {
                        field.onChange(c);
                        onDegreeCompleted(c);
                      }}
                    />
                    <FormLabel className="flex items-center ml-4 mb-2">
                      {field.value ? "已毕业" : "在读"}
                    </FormLabel>

                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* DESCRIPTION */}
            <div className="md:col-span-2">
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <TiptapEditor field={field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormDialogFooter
              onCancel={closeDialog}
              isPending={isPending}
              saveDisabled={!formState.isDirty}
            />
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AddEducation;
