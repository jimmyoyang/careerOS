"use client";
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
import { Company } from "@/models/job.model";
import {
  Briefcase,
  Building2,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Trash,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { deleteCompanyById, setCompanyWatched } from "@/actions/company.actions";
import { toastSuccess, toastError } from "@/lib/toast";
import { DeleteAlertDialog } from "../DeleteAlertDialog";
import { AlertDialog } from "@/models/alertDialog.model";
import { BoardCell } from "./BoardCell";

type CompaniesTableProps = {
  companies: Company[];
  reloadCompanies: () => void;
  editCompany: (id: string) => void;
  scope?: "mine" | "watchlist";
};

function CompaniesTable({
  companies,
  reloadCompanies,
  editCompany,
  scope = "mine",
}: CompaniesTableProps) {
  const [alert, setAlert] = useState<AlertDialog>({
    openState: false,
    deleteAction: false,
  });

  const onDeleteCompany = (company: Company) => {
    const totalJobs = company._count?.jobsTotal ?? 0;
    if (totalJobs > 0) {
      setAlert({
        openState: true,
        title: "存在关联职位！",
        description: `该公司关联了 ${totalJobs} 个职位（包括未投递的职位）。请先删除或调整这些职位的关联，再删除该公司。`,
        deleteAction: false,
      });
    } else {
      setAlert({
        openState: true,
        deleteAction: true,
        itemId: company.id,
      });
    }
  };

  const detailsHref = (id: string) =>
    `/dashboard/admin/companies/${id}${scope === "watchlist" ? "?scope=watchlist" : ""}`;

  const toggleWatch = async (company: Company) => {
    const next = !company.watched;
    const res = await setCompanyWatched(company.id, next);
    if (res.success) {
      toastSuccess(
        next
          ? `${company.label}已加入关注列表`
          : `${company.label}已从关注列表移除，仍保留在公司库中。`,
      );
      reloadCompanies();
    } else {
      toastError(res.message);
    }
  };

  const deleteCompany = async (companyId: string | undefined) => {
    if (companyId) {
      const { res, success, message } = await deleteCompanyById(companyId);
      if (success) {
        toastSuccess("公司已删除");
        reloadCompanies();
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
            <TableHead className="hidden w-[100px] sm:table-cell">
              <span className="sr-only">公司标志</span>
            </TableHead>
            <TableHead>公司名称</TableHead>
            {scope === "watchlist" ? (
              <>
                <TableHead>招聘平台</TableHead>
                <TableHead>职位</TableHead>
                <TableHead>已关注</TableHead>
              </>
            ) : (
              <>
                <TableHead className="hidden sm:table-cell">标识值</TableHead>
                <TableHead>职位总数</TableHead>
                <TableHead>已投递职位</TableHead>
                <TableHead>已拒绝</TableHead>
                <TableHead>联系人</TableHead>
              </>
            )}
            <TableHead>操作</TableHead>
            <TableHead>
              <span className="sr-only">操作</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {companies.map((company: Company) => {
            return (
              <TableRow key={company.id}>
                <TableCell className="hidden sm:table-cell">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt="公司标志"
                    className="w-8 h-8 rounded-md object-cover"
                    src={company.logoUrl || "/images/jobsync-logo.svg"}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/images/jobsync-logo.svg";
                    }}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <span className="flex items-center gap-1.5">
                    <Link
                      href={detailsHref(company.id)}
                      className="hover:underline underline-offset-4"
                    >
                      {company.label}
                    </Link>
                    {company.watched && (
                      <span
                        title="已加入关注列表"
                        className="text-emerald-600 dark:text-emerald-400"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {scope !== "watchlist" && company.atsToken && (
                      <BoardCell company={company} />
                    )}
                  </span>
                </TableCell>
                {scope === "watchlist" ? (
                  <>
                    <TableCell>
                      <BoardCell company={company} />
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsTotal ?? 0}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {company.watchedAt
                        ? formatDistanceToNow(new Date(company.watchedAt), {
                            addSuffix: true,
                          })
                        : "—"}
                    </TableCell>
                  </>
                ) : (
                  <>
                    <TableCell className="font-medium hidden sm:table-cell">
                      {company.value}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsTotal ? (
                        <Link
                          href={`/dashboard/myjobs?company=${encodeURIComponent(company.value)}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {company._count.jobsTotal}
                        </Link>
                      ) : (
                        (company._count?.jobsTotal ?? 0)
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsApplied ? (
                        <Link
                          href={`/dashboard/myjobs?company=${encodeURIComponent(company.value)}&applied=true`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {company._count.jobsApplied}
                        </Link>
                      ) : (
                        (company._count?.jobsApplied ?? 0)
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.jobsRejected ?? 0}
                    </TableCell>
                    <TableCell className="font-medium">
                      {company._count?.contacts ?? 0}
                    </TableCell>
                  </>
                )}
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
                      <DropdownMenuItem className="cursor-pointer" asChild>
                        <Link href={detailsHref(company.id)}>
                          <Building2 className="mr-2 h-4 w-4" />
                          查看详情
                        </Link>
                      </DropdownMenuItem>
                      {company._count?.jobsApplied ? (
                        <DropdownMenuItem className="cursor-pointer" asChild>
                          <Link
                            href={`/dashboard/myjobs?company=${encodeURIComponent(company.value)}&applied=true`}
                          >
                            <Briefcase className="mr-2 h-4 w-4" />
                            查看职位
                          </Link>
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => editCompany(company.id)}
                      >
                        <Pencil className="mr-2 h-4 w-4" />
                        编辑公司
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => toggleWatch(company)}
                      >
                        {company.watched ? (
                          <EyeOff className="mr-2 h-4 w-4" />
                        ) : (
                          <Eye className="mr-2 h-4 w-4" />
                        )}
                        {company.watched ? "取消关注" : "关注"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600 cursor-pointer"
                        onClick={() => onDeleteCompany(company)}
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
        pageTitle="公司"
        open={alert.openState}
        onOpenChange={() => setAlert({ openState: false, deleteAction: false })}
        onDelete={() => deleteCompany(alert.itemId)}
        alertTitle={alert.title}
        alertDescription={alert.description}
        deleteAction={alert.deleteAction}
      />
    </>
  );
}

export default CompaniesTable;
