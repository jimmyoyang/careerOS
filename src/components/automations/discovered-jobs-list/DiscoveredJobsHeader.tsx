"use client";

import { zhLabel } from "@/lib/i18n/zh-CN";

import { CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListFilter, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DISCOVERY_STATUSES } from "@/lib/constants";
import { RecordsCount } from "@/components/RecordsCount";
import type { DiscoveryStatus } from "@/models/automation.model";

interface DiscoveredJobsHeaderProps {
  loadedCount: number;
  totalJobs: number;
  showClear: boolean;
  onClear: () => void;
  statusFilter: DiscoveryStatus[];
  onStatusFilterChange: (filter: DiscoveryStatus[]) => void;
}

export function DiscoveredJobsHeader({
  loadedCount,
  totalJobs,
  showClear,
  onClear,
  statusFilter,
  onStatusFilterChange,
}: DiscoveredJobsHeaderProps) {
  const toggleStatusFilter = (status: DiscoveryStatus, checked: boolean) => {
    onStatusFilterChange(
      checked
        ? [...statusFilter, status]
        : statusFilter.filter((s) => s !== status),
    );
  };

  return (
    <CardHeader>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>发现的岗位</CardTitle>
          {totalJobs > 0 && (
            <RecordsCount count={loadedCount} total={totalJobs} label="个岗位" />
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showClear && (
            <Button variant="outline" size="sm" onClick={onClear}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              清空
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ListFilter className="h-4 w-4 mr-1.5" />
                状态
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>按状态筛选</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {DISCOVERY_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status.value}
                  checked={statusFilter.includes(status.value)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(checked) =>
                    toggleStatusFilter(status.value, checked)
                  }
                >
                  {zhLabel(status.label)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </CardHeader>
  );
}
