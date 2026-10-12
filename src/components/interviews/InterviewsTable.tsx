"use client";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import InterviewRow from "./InterviewRow";
import type { InterviewRow as InterviewRowType } from "@/models/interview.model";

type InterviewsTableProps = {
  interviews: InterviewRowType[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onEdit: (interview: InterviewRowType) => void;
  onChanged: () => void;
};

function InterviewsTable({
  interviews,
  expandedId,
  onToggle,
  onEdit,
  onChanged,
}: InterviewsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8">
            <span className="sr-only">展开</span>
          </TableHead>
          <TableHead>时间</TableHead>
          <TableHead>职位</TableHead>
          <TableHead>轮次</TableHead>
          <TableHead className="hidden md:table-cell">形式</TableHead>
          <TableHead className="hidden lg:table-cell">面试官</TableHead>
          <TableHead className="hidden sm:table-cell">准备</TableHead>
          <TableHead>结果</TableHead>
          <TableHead>
            <span className="sr-only">操作</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {interviews.map((interview) => (
          <InterviewRow
            key={interview.id}
            interview={interview}
            expanded={expandedId === interview.id}
            onToggle={() => onToggle(interview.id)}
            onEdit={() => onEdit(interview)}
            onOutcomeSaved={onChanged}
          />
        ))}
      </TableBody>
    </Table>
  );
}

export default InterviewsTable;
