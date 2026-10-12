"use client";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { TagInput } from "@/components/myjobs/TagInput";
import { toastActionResult } from "@/lib/toast";
import { addStagePrepQuestions } from "@/actions/jobStage.actions";
import { createQuestion, getQuestionsList } from "@/actions/question.actions";
import { getAllTags } from "@/actions/tag.actions";
import type { Tag } from "@/models/job.model";
import type { JobStage } from "@/models/jobStage.model";
import { stageHeading } from "./stageDisplay";

type BankQuestion = { id: string; question: string; tags: Tag[] };

type AddPrepQuestionsDialogProps = {
  open: boolean;
  stage: JobStage | null;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
};

// A cap rather than an unbounded read: the search below filters client-side,
// which is what makes the artboard's instant search possible at all.
const BANK_PAGE_SIZE = 200;

// The question bank requires an answer; use the Chinese placeholder
// for one that has not been written yet (QuestionForm).
const UNANSWERED = "待填写";

export function AddPrepQuestionsDialog({
  open,
  stage,
  onOpenChange,
  onAdded,
}: AddPrepQuestionsDialogProps) {
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [newTagIds, setNewTagIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const loaded = useRef(false);
  const rowId = useId();

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    void (async () => {
      const [res, allTags] = await Promise.all([
        getQuestionsList(1, BANK_PAGE_SIZE),
        getAllTags(),
      ]);
      if (res?.success && Array.isArray(res.data)) setBank(res.data);
      if (Array.isArray(allTags)) setTags(allTags);
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelected([]);
    setNewQuestion("");
    setNewTagIds([]);
  }, [open, stage]);

  if (!stage) return null;

  const alreadyLinked = new Set(
    (stage.prepQuestions ?? []).map((row) => row.questionId),
  );
  const term = search.trim().toLowerCase();
  const visible = term
    ? bank.filter((q) => q.question.toLowerCase().includes(term))
    : bank;

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );

  const addQuestion = () =>
    startTransition(async () => {
      const res = await createQuestion({
        question: newQuestion.trim(),
        answer: UNANSWERED,
        tagIds: newTagIds,
      });
      toastActionResult(res, {
        success: "题目已添加到题库",
        onSuccess: () => {
          // Banked and selected in one click: the user asked for it here.
          setBank((prev) => [res.data, ...prev]);
          setSelected((prev) => [...prev, res.data.id]);
          setNewQuestion("");
          setNewTagIds([]);
        },
      });
    });

  const submit = () => {
    if (selected.length === 0) {
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      const res = await addStagePrepQuestions(stage.id, selected);
      toastActionResult(res, {
        success: "准备清单已更新",
        onSuccess: () => {
          onAdded();
          onOpenChange(false);
        },
      });
    });
  };

  const doneLabel =
    selected.length === 0
      ? "完成"
      : `完成，已将 ${selected.length} 道题目加入准备清单`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] max-h-[800px] overflow-hidden">
        <DialogHeader>
          <DialogTitle>向准备清单添加题目</DialogTitle>
          <DialogDescription>{stageHeading(stage)}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-1">
          <p className="text-[13px] text-muted-foreground">
            选择你预计会被问到的题目。面试后，可在进展记录中勾选实际问过的题目。
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="搜索题库…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((id) => {
                const q = bank.find((row) => row.id === id);
                if (!q) return null;
                return (
                  <span
                    key={id}
                    className="flex max-w-full items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-xs"
                  >
                    <span className="truncate">{q.question}</span>
                    <button
                      type="button"
                      aria-label={`移除${q.question}`}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full hover:bg-primary/20"
                      onClick={() => toggle(id, false)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          <ul className="overflow-hidden rounded-lg border">
            {visible.length === 0 && (
              <li className="px-3.5 py-4 text-[13px] text-muted-foreground">
                未找到符合搜索条件的题目。
              </li>
            )}
            {visible.map((q, index) => {
              const isLinked = alreadyLinked.has(q.id);
              return (
                <li
                  key={q.id}
                  className={`flex items-start gap-2.5 px-3.5 py-2.5 ${
                    index > 0 ? "border-t" : ""
                  }`}
                >
                  <input
                    id={`${rowId}-${q.id}`}
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    checked={isLinked || selected.includes(q.id)}
                    disabled={isLinked}
                    onChange={(e) => toggle(q.id, e.target.checked)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={`${rowId}-${q.id}`}
                      className="block cursor-pointer text-[13px]"
                    >
                      {q.question}
                    </label>
                    {(q.tags?.length ?? 0) > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {q.tags?.map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-[11px]"
                          >
                            {tag.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {isLinked && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      已在准备清单中
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="space-y-3 rounded-lg border border-dashed p-3.5">
            <p className="text-[13px] font-semibold">添加新题目</p>
            <Input
              placeholder="输入新的面试题目…"
              aria-label="新建题目"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
            />
            <div className="space-y-1.5">
              <p className="text-[13px] font-medium">技能标签</p>
              <TagInput
                availableTags={tags}
                selectedTagIds={newTagIds}
                onChange={setNewTagIds}
                onTagCreated={(tag) => setTags((prev) => [...prev, tag])}
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || !newQuestion.trim()}
              onClick={addQuestion}
            >
              添加题目
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {doneLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
