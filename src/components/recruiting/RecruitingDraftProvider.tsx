"use client";

import { createContext, useContext, useRef, type ReactNode, type RefObject } from "react";
import type { RecruitingData, RecruitingDocument } from "@/lib/recruiting/contracts";

type DraftSnapshot = { saved: RecruitingDocument; draft: RecruitingData };
const RecruitingDraftContext = createContext<RefObject<DraftSnapshot | null> | null>(null);

function DraftStore({ children }: { children: ReactNode }) {
  const draft = useRef<DraftSnapshot | null>(null);
  return <RecruitingDraftContext.Provider value={draft}>{children}</RecruitingDraftContext.Provider>;
}

// Dashboard layout survives client Back/Forward navigation. The key discards
// this memory-only draft when the authenticated user changes; no PII is stored
// in localStorage, sessionStorage, history state, or a module-level singleton.
export function RecruitingDraftProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <DraftStore key={userId}>{children}</DraftStore>;
}

export function useRecruitingDraft() {
  return useContext(RecruitingDraftContext);
}
