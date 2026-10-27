import QuestionsPageClient from "./QuestionsPageClient";
import { getTagsWithQuestionCounts } from "@/actions/question.actions";
import { getAllTags } from "@/actions/tag.actions";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "面试题库" };

import React from "react";

async function Questions({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  const { stage } = await searchParams;
  const [allTags, tagsWithCounts] = await Promise.all([
    getAllTags(),
    getTagsWithQuestionCounts(stage),
  ]);

  return (
    <>
    <div className="col-span-3"><PageHeader title="面试题库" description="按标签整理题目，记录回答并持续复习。" /></div>
    <QuestionsPageClient
      allTags={allTags || []}
      tagsWithCounts={tagsWithCounts?.data || []}
      totalQuestions={tagsWithCounts?.totalQuestions || 0}
    />
    </>
  );
}

export default Questions;
