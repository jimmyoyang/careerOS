import type { JobDetails } from "@/lib/scraper/types";

export type DomesticProvider = "tencent" | "alibaba" | "meituan";

export type DomesticJob = JobDetails & {
  postingId: string;
  platform: DomesticProvider;
  sourceUrl?: string;
};

export type DomesticFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
