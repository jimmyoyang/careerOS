"use client";
import { Question } from "@/models/question.model";
import { QuestionCard } from "./QuestionCard";

type QuestionListProps = {
  questions: Question[];
  onEdit: (question: Question) => void;
  onDelete: (questionId: string) => void;
};

export function QuestionList({ questions, onEdit, onDelete }: QuestionListProps) {
  if (questions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        暂无题目，创建第一道题目即可开始。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
