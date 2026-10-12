"use client";
import { zhLabel } from "@/lib/i18n/zh-CN";

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
import { ContactRole } from "@/models/contact.model";
import { MoreVertical, Trash } from "lucide-react";
import { AlertDialog } from "@/models/alertDialog.model";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { deleteContactRoleById } from "@/actions/contactRole.actions";
import { toastSuccess, toastError } from "@/lib/toast";

type ContactRolesTableProps = {
  roles: ContactRole[];
  reloadRoles: () => void;
};

function ContactRolesTable({ roles, reloadRoles }: ContactRolesTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteRole = (role: ContactRole) => {
    const links = role._count?.jobContacts ?? 0;
    const holders = role._count?.contacts ?? 0;
    if (links > 0 || holders > 0) {
      setAlert({
        openState: true,
        title: "存在关联联系人！",
        description: links
          ? `该角色用于 ${links} 条联系人关联。请先移除这些关联，再删除该角色。`
          : `有 ${holders} 位联系人使用该角色。请先更改他们的角色，再删除该角色。`,
        deleteAction: false,
      });
    } else {
      setAlert({ openState: true, deleteAction: true, itemId: role.id });
    }
  };

  const deleteRole = async (roleId: string) => {
    if (roleId) {
      const { success, message } = await deleteContactRoleById(roleId);
      if (success) {
        toastSuccess("联系人角色已删除");
        reloadRoles();
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
            <TableHead>角色</TableHead>
            <TableHead className="hidden sm:table-cell">标识值</TableHead>
            <TableHead>关联联系人数</TableHead>
            <TableHead>
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roles.map((role: ContactRole) => {
            return (
              <TableRow key={role.id}>
                <TableCell className="font-medium">{zhLabel(role.label)}</TableCell>
                <TableCell className="font-medium hidden sm:table-cell">
                  {role.value}
                </TableCell>
                <TableCell className="font-medium">
                  {role._count?.jobContacts ?? 0}
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
                        onClick={() => onDeleteRole(role)}
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
        pageTitle="角色"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteRole(alert.itemId!)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default ContactRolesTable;
