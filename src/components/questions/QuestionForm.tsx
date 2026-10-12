"use client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createQuestion, updateQuestion } from "@/actions/question.actions";
import { Loader } from "lucide-react";
import { Button } from "../ui/button";
import { useForm } from "react-hook-form";
import { useEffect, useState, useTransition } from "react";
import { AddQuestionFormSchema } from "@/models/addQuestionForm.schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Question } from "@/models/question.model";
import { Tag } from "@/models/job.model";
import { z } from "zod";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import TiptapEditor from "../TiptapEditor";
import { TagInput } from "../myjobs/TagInput";

type QuestionFormProps = {
  availableTags: Tag[];
  editQuestion?: Question | null;
  resetEditQuestion: () => void;
  onQuestionSaved: () => void;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
};

export function QuestionForm({
  availableTags,
  editQuestion,
  resetEditQuestion,
  onQuestionSaved,
  dialogOpen,
  setDialogOpen,
}: QuestionFormProps) {
  const [isPending, startTransition] = useTransition();
  const [localAvailableTags, setLocalAvailableTags] =
    useState<Tag[]>(availableTags);
  const form = useForm<z.infer<typeof AddQuestionFormSchema>>({
    resolver: zodResolver(AddQuestionFormSchema),
    defaultValues: {
      question: "",
      answer: "待填写",
      tagIds: [],
    },
  });

  const { reset } = form;

  useEffect(() => {
    if (editQuestion) {
      reset({
        id: editQuestion.id,
        question: editQuestion.question,
        answer: editQuestion.answer || "",
        tagIds: editQuestion.tags?.map((t) => t.id) || [],
      });
      // Merge the question's own tags into the local pool so they're
      // selectable/visible even if they aren't in the availableTags prop yet
      // (e.g. just created in the Add dialog earlier in this page session).
      if (editQuestion.tags && editQuestion.tags.length > 0) {
        setLocalAvailableTags((prev) => {
          const existing = new Set(prev.map((t) => t.id));
          const incoming = editQuestion.tags!.filter(
            (t) => !existing.has(t.id),
          );
          return incoming.length > 0 ? [...prev, ...incoming] : prev;
        });
      }
    } else {
      reset({
        question: "",
        answer: "待填写",
        tagIds: [],
      });
    }
  }, [editQuestion, reset]);

  function onSubmit(data: z.infer<typeof AddQuestionFormSchema>) {
    startTransition(async () => {
      const { success, message } = editQuestion
        ? await updateQuestion(data)
        : await createQuestion(data);

      if (success) {
        toastSuccess(`题目已${editQuestion ? "更新" : "创建"}`);
        reset();
        setDialogOpen(false);
        resetEditQuestion();
        onQuestionSaved();
      } else {
        toastError(message);
      }
    });
  }

  const pageTitle = editQuestion ? "编辑题目" : "添加题目";
  const pageDescription = editQuestion
    ? "更新题库中的这道题目。"
    : "向题库添加一道题目。";

  const closeDialog = () => {
    reset();
    resetEditQuestion();
    setDialogOpen(false);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogOverlay>
        <DialogContent className="sm:max-w-[725px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="question-form-dialog-title">
              {pageTitle}
            </DialogTitle>
            <DialogDescription>{pageDescription}</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="grid grid-cols-1 gap-4 p-4"
            >
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>题目 *</FormLabel>
                    <FormControl>
                      <Input placeholder="输入面试题目" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tagIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>技能标签</FormLabel>
                    <FormControl>
                      <TagInput
                        availableTags={localAvailableTags}
                        selectedTagIds={field.value || []}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="answer"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>答案 *</FormLabel>
                    <FormControl>
                      <TiptapEditor field={field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="reset"
                  variant="outline"
                  className="mt-2 md:mt-0"
                  onClick={closeDialog}
                >
                  取消
                </Button>
                <Button type="submit">
                  保存
                  {isPending && (
                    <Loader className="h-4 w-4 shrink-0 spinner ml-2" />
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </DialogOverlay>
    </Dialog>
  );
}
