"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getJobsList } from "@/actions/job.actions";
import type { JobResponse } from "@/models/job.model";

export const SEARCH_PAGE_SIZE = 24;
export type SearchField = "q" | "source" | "location" | "status" | "title" | "page" | "view";

export function useJobSearch() {
  const params = useSearchParams();
  const router = useRouter();
  const serializedParams = params.toString();
  const pendingNavigations = useRef<string[]>([]);
  const query = params.get("q") ?? "";
  const source = params.get("source") ?? "";
  const location = params.get("location") ?? "";
  const status = params.get("status") ?? "";
  const title = params.get("title") ?? "";
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1;
  const view = params.get("view") === "table" ? "table" : "cards";
  const [draftQuery, setDraftQuery] = useState(query);
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<{ jobs: JobResponse[]; total: number; error: string; loading: boolean }>({
    jobs: [], total: 0, error: "", loading: true,
  });

  // Acknowledging our own navigation must not overwrite text typed while it
  // was in flight. Header searches and Back/Forward still replace the draft.
  useEffect(() => {
    const acknowledged = pendingNavigations.current.indexOf(serializedParams);
    if (acknowledged >= 0) {
      pendingNavigations.current.splice(0, acknowledged + 1);
    } else {
      pendingNavigations.current = [];
      setDraftQuery(query);
    }
  }, [serializedParams, query]);

  const update = useCallback((changes: Partial<Record<SearchField, string>>, resetPage = true) => {
    // Consecutive interactions can arrive before App Router commits the URL.
    const next = new URLSearchParams(pendingNavigations.current.at(-1) ?? serializedParams);
    if (resetPage) next.delete("page");
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const serializedNext = next.toString();
    if (serializedNext !== (pendingNavigations.current.at(-1) ?? serializedParams)) {
      // Returning to the already-committed URL cancels earlier requests but
      // produces no URL change for the acknowledgement effect to observe.
      if (serializedNext === serializedParams) pendingNavigations.current = [];
      else pendingNavigations.current.push(serializedNext);
      router.replace(`/dashboard/search${next.size ? `?${next}` : ""}`, { scroll: false });
    }
  }, [serializedParams, router]);

  useEffect(() => {
    // This debounce commits the keyword to the URL. Fetching is driven solely
    // by that URL, so filters, pagination and the visible input stay in sync.
    const pendingQuery = new URLSearchParams(pendingNavigations.current.at(-1) ?? serializedParams).get("q") ?? "";
    if (draftQuery.trim() === pendingQuery) return;
    const timer = window.setTimeout(() => update({ q: draftQuery.trim() }), 300);
    return () => window.clearTimeout(timer);
  }, [draftQuery, serializedParams, update]);

  useEffect(() => {
    let active = true;
    setResult({ jobs: [], total: 0, error: "", loading: true });
    void (async () => {
      try {
        const response = await getJobsList(
          page, SEARCH_PAGE_SIZE, status || undefined, query.trim() || undefined,
          undefined, undefined, title || undefined, location || undefined, source || undefined,
        );
        if (!active) return;
        if (!response?.success || !Array.isArray(response.data)) {
          throw new Error(response?.message || "职位搜索失败，请稍后重试");
        }
        setResult({ jobs: response.data, total: response.total ?? response.data.length, error: "", loading: false });
      } catch (error) {
        if (active) setResult({ jobs: [], total: 0, error: error instanceof Error ? error.message : "职位搜索失败，请稍后重试", loading: false });
      }
    })();
    return () => { active = false; };
  }, [query, source, location, status, title, page, retryCount]);

  const retry = () => setRetryCount((count) => count + 1);
  const submit = () => {
    update({ q: draftQuery.trim() });
    if (query === draftQuery.trim() && page === 1) retry();
  };
  return { ...result, query, draftQuery, setDraftQuery, source, location, status, title, page, view, update, retry, submit };
}
