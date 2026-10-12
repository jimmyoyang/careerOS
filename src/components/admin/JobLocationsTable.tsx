"use client";
import { useState } from "react";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
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
import { JobLocation } from "@/models/job.model";
import { Briefcase, MoreVertical, Trash } from "lucide-react";
import Link from "next/link";
import { AlertDialog } from "@/models/alertDialog.model";
import { toastSuccess, toastError } from "@/lib/toast";
import { deleteJobLocationById } from "@/actions/jobLocation.actions";

type JobLocationsTableProps = {
  jobLocations: JobLocation[];
  reloadJobLocations: () => void;
};

function JobLocationsTable({
  jobLocations,
  reloadJobLocations,
}: JobLocationsTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });
  const onDeleteJobLocation = (location: JobLocation) => {
    const totalJobs = location._count?.jobsTotal ?? 0;
    if (totalJobs > 0) {
      setAlert({
        openState: true,
        title: "存在关联职位！",
        description: `该工作地点关联了 ${totalJobs} 个职位（包括未投递的职位）。请先删除或调整这些职位的关联，再删除该工作地点。`,
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: location.id,
      });
    }
  };
  const deleteJobLocation = async (locationId: string) => {
    if (locationId) {
      const { success, message } = await deleteJobLocationById(locationId);
      if (success) {
        toastSuccess("工作地点已删除");
        reloadJobLocations();
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
            <TableHead>地点</TableHead>
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
          {jobLocations.map((location: JobLocation) => {
            return (
              <TableRow key={location.id}>
                <TableCell className="font-medium">{location.label}</TableCell>
                <TableCell className="font-medium hidden sm:table-cell">
                  {location.value}
                </TableCell>
                <TableCell className="font-medium">
                  {location._count?.jobsTotal ? (
                    <Link
                      href={`/dashboard/myjobs?location=${encodeURIComponent(location.value)}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {location._count.jobsTotal}
                    </Link>
                  ) : (
                    (location._count?.jobsTotal ?? 0)
                  )}
                </TableCell>
                <TableCell className="font-medium">
                  {location._count?.jobsApplied ? (
                    <Link
                      href={`/dashboard/myjobs?location=${encodeURIComponent(location.value)}&applied=true`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {location._count.jobsApplied}
                    </Link>
                  ) : (
                    (location._count?.jobsApplied ?? 0)
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
                      {location._count?.jobsApplied ? (
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link
                            href={`/dashboard/myjobs?location=${encodeURIComponent(location.value)}&applied=true`}
                          >
                            <Briefcase className="mr-2 h-4 w-4" />
                            查看职位
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteJobLocation(location)}
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
        pageTitle="地点"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteJobLocation(alert.itemId!)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default JobLocationsTable;
