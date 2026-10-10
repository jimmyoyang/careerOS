"use client";
import { zhLabel } from "@/lib/i18n/zh-CN";

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
import { MoreVertical, Trash } from "lucide-react";
import { useState } from "react";
import { deleteActivityTypeById } from "@/actions/activity.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AlertDialog } from "@/models/alertDialog.model";

type ActivityTypeRow = {
  id: string;
  label: string;
  value: string;
  totalDuration: number;
  _count?: { Activities?: number; Tasks?: number };
};

type ActivityTypesTableProps = {
  activityTypes: ActivityTypeRow[];
  reloadActivityTypes: () => void;
};

function ActivityTypesTable({
  activityTypes,
  reloadActivityTypes,
}: ActivityTypesTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDelete = (at: ActivityTypeRow) => {
    const activityCount = at._count?.Activities ?? 0;
    const taskCount = at._count?.Tasks ?? 0;

    if (activityCount > 0 || taskCount > 0) {
      const links = [
        activityCount > 0 ? `${activityCount} 项活动` : "",
        taskCount > 0 ? `${taskCount} 项任务` : "",
      ]
        .filter(Boolean)
        .join("和");

      setAlert({
        openState: true,
        title: "活动类型正在使用中！",
        description: `该活动类型关联了${links}，无法删除。`,
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: at.id,
      });
    }
  };

  const deleteType = async (id: string | undefined) => {
    if (!id) return;
    const { success, message } = await deleteActivityTypeById(id);
    if (success) {
      toastSuccess("活动类型已删除");
      reloadActivityTypes();
    } else {
      toastError(message);
    }
  };

  const formatHours = (minutes: number) => {
    const hours = minutes / 60;
    return hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
  };

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead className="hidden sm:table-cell">标识值</TableHead>
            <TableHead>活动数量</TableHead>
            <TableHead>任务数量</TableHead>
            <TableHead>总时长</TableHead>
            <TableHead>操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activityTypes.map((at) => (
            <TableRow key={at.id}>
              <TableCell className="font-medium">{zhLabel(at.label)}</TableCell>
              <TableCell className="font-medium hidden sm:table-cell">
                {at.value}
              </TableCell>
              <TableCell className="font-medium">
                {at._count?.Activities ?? 0}
              </TableCell>
              <TableCell className="font-medium">
                {at._count?.Tasks ?? 0}
              </TableCell>
              <TableCell className="font-medium">
                {formatHours(at.totalDuration)} 小时
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
                    <DropdownMenuItem
                      className="text-red-600 cursor-pointer"
                      onClick={() => onDelete(at)}
                    >
                      <Trash className="mr-2 h-4 w-4" />
                      删除
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <DeleteAlertDialog
        pageTitle="活动类型"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteType(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default ActivityTypesTable;
