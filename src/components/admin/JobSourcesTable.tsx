"use client";
import { useState } from "react";
import { Button } from "../ui/button";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { JobSource } from "@/models/job.model";
import { Briefcase, MoreVertical, Trash } from "lucide-react";
import Link from "next/link";
import { AlertDialog } from "@/models/alertDialog.model";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { deleteJobSourceById } from "@/actions/jobSource.actions";
import { toastSuccess, toastError } from "@/lib/toast";

type JobSourcesTableProps = {
  jobSources: JobSource[];
  reloadJobSources: () => void;
};

function JobSourcesTable({
  jobSources,
  reloadJobSources,
}: JobSourcesTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteJobSource = (source: JobSource) => {
    const totalJobs = source._count?.jobsTotal ?? 0;
    if (totalJobs > 0) {
      setAlert({
        openState: true,
        title: "存在关联职位！",
        description: `该职位来源关联了 ${totalJobs} 个职位（包括未投递的职位）。请先删除或调整这些职位的关联，再删除该职位来源。`,
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: source.id,
      });
    }
  };

  const deleteJobSource = async (sourceId: string) => {
    if (sourceId) {
      const { success, message } = await deleteJobSourceById(sourceId);
      if (success) {
        toastSuccess("职位来源已删除");
        reloadJobSources();
      } else {
        toastError(message);
      }
    }
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>来源</TableHead>
            <TableHead className="hidden sm:table-cell">标识值</TableHead>
            <TableHead>职位总数</TableHead>
            <TableHead>已投递职位</TableHead>
            <TableHead>操作</TableHead>
            <TableHead>
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobSources.map((source: JobSource) => {
            return (
              <TableRow key={source.id}>
                <TableCell className="font-medium">{source.label}</TableCell>
                <TableCell className="font-medium hidden sm:table-cell">
                  {source.value}
                </TableCell>
                <TableCell className="font-medium">
                  {source._count?.jobsTotal ? (
                    <Link
                      href={`/dashboard/myjobs?source=${encodeURIComponent(source.value)}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {source._count.jobsTotal}
                    </Link>
                  ) : (
                    (source._count?.jobsTotal ?? 0)
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {source._count?.jobsApplied ? (
                    <Link
                      href={`/dashboard/myjobs?source=${encodeURIComponent(source.value)}&applied=true`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {source._count.jobsApplied}
                    </Link>
                  ) : (
                    (source._count?.jobsApplied ?? 0)
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">打开菜单</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>操作</DropdownMenuLabel>
                      {source._count?.jobsApplied ? (
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link
                            href={`/dashboard/myjobs?source=${encodeURIComponent(source.value)}&applied=true`}
                          >
                            <Briefcase className="mr-2 h-4 w-4" />
                            查看职位
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteJobSource(source)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle="来源"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteJobSource(alert.itemId!)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default JobSourcesTable;
