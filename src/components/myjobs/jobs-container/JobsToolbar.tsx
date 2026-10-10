"use client";
import { File, ListFilter, RefreshCw, X } from "lucide-react";
import { CardHeader, CardTitle } from "../../ui/card";
import { Button } from "../../ui/button";
import { SearchInput } from "../../SearchInput";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import { RecordsCount } from "../../RecordsCount";
import { JobsViewToggle } from "../JobsViewToggle";
import { AddJob } from "../AddJob";
import {
  Company,
  JobLocation,
  JobResponse,
  JobSource,
  JobStatus,
  JobsViewMode,
  JobTitle,
  Tag,
} from "@/models/job.model";

// Presentational: the Jobs card header — title/count, active filter chips,
// view toggle, search, filter select, export and Add Job.
export function JobsToolbar({
  jobsCount,
  totalJobs,
  initialLoading,
  viewMode,
  onChangeViewMode,
  companyLabel,
  onClearCompanyFilter,
  titleLabel,
  onClearTitleFilter,
  locationLabel,
  onClearLocationFilter,
  sourceLabel,
  onClearSourceFilter,
  onReload,
  searchTerm,
  onSearchTermChange,
  filterKey,
  onFilterChange,
  onDownload,
  statuses,
  companies,
  titles,
  locations,
  sources,
  tags,
  editJob,
  resetEditJob,
  addJobInitialOpen,
}: {
  jobsCount: number;
  totalJobs: number;
  initialLoading: boolean;
  viewMode: JobsViewMode;
  onChangeViewMode: (mode: JobsViewMode) => void;
  companyLabel?: string | null;
  onClearCompanyFilter: () => void;
  titleLabel?: string | null;
  onClearTitleFilter: () => void;
  locationLabel?: string | null;
  onClearLocationFilter: () => void;
  sourceLabel?: string | null;
  onClearSourceFilter: () => void;
  onReload: () => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  filterKey: string;
  onFilterChange: (filterBy: string) => void;
  onDownload: () => void;
  statuses: JobStatus[];
  companies: Company[];
  titles: JobTitle[];
  locations: JobLocation[];
  sources: JobSource[];
  tags: Tag[];
  editJob: JobResponse | null;
  resetEditJob: () => void;
  addJobInitialOpen: boolean;
}) {
  return (
    <CardHeader className="flex-row flex-wrap justify-between items-center gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <CardTitle>职位</CardTitle>
        {!initialLoading && totalJobs > 0 && (
          <RecordsCount count={jobsCount} total={totalJobs} label="职位" />
        )}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
        <JobsViewToggle value={viewMode} onChange={onChangeViewMode} />
        {companyLabel && (
          <button
            onClick={onClearCompanyFilter}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {companyLabel}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {titleLabel && (
          <button
            onClick={onClearTitleFilter}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {titleLabel}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {locationLabel && (
          <button
            onClick={onClearLocationFilter}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {locationLabel}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        {sourceLabel && (
          <button
            onClick={onClearSourceFilter}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
          >
            {sourceLabel}
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0"
          disabled={initialLoading}
          title="重新加载职位"
          onClick={onReload}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${initialLoading ? "animate-spin" : ""}`}
          />
          <span className="sr-only">重新加载职位</span>
        </Button>
        <SearchInput
          value={searchTerm}
          onChange={onSearchTermChange}
          placeholder="搜索职位…"
        />
        <Select value={filterKey} onValueChange={onFilterChange}>
          <SelectTrigger
            className="w-[120px] h-8"
            data-testid="job-filter-select"
          >
            <ListFilter className="h-3.5 w-3.5" />
            <SelectValue placeholder="筛选" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>筛选条件</SelectLabel>
              <SelectSeparator />
              <SelectItem value="none">全部（不含已忽略）</SelectItem>
              <SelectItem value="applied">已投递</SelectItem>
              <SelectItem value="interview">面试中</SelectItem>
              <SelectItem value="draft">草稿</SelectItem>
              <SelectItem value="rejected">已拒绝</SelectItem>
              <SelectItem value="PT">兼职</SelectItem>
              <SelectItem value="accepted">已收录（发现的职位）</SelectItem>
              <SelectItem value="dismissed">已忽略（发现的职位）</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1"
          disabled={initialLoading}
          onClick={onDownload}
        >
          <File className="h-3.5 w-3.5" />
          <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
            导出
          </span>
        </Button>
        <AddJob
          jobStatuses={statuses}
          companies={companies}
          jobTitles={titles}
          locations={locations}
          jobSources={sources}
          tags={tags}
          editJob={editJob}
          resetEditJob={resetEditJob}
          initialOpen={addJobInitialOpen}
        />
      </div>
    </CardHeader>
  );
}
