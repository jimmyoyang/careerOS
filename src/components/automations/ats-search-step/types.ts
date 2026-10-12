import type { LeverSourceConfig } from "@/models/automation.model";

// The step is provider-agnostic; it edits the canonical Lever config shape — a
// superset of Greenhouse's, where the extra per-company `host` is unused and
// UI-invisible for Greenhouse.
export type AtsConfigValue = LeverSourceConfig;

export type EntityOption = { id: string; label: string; value: string };

export const PROVIDER_META: Record<
  string,
  { label: string; urlHint: string; searchExample: string }
> = {
  greenhouse: {
    label: "Greenhouse",
    urlHint: "或粘贴 boards.greenhouse.io 链接",
    searchExample: "Anthropic",
  },
  lever: {
    label: "Lever",
    urlHint: "或粘贴 jobs.lever.co 链接或标识",
    searchExample: "Netflix",
  },
  ashby: {
    label: "Ashby",
    urlHint: "或粘贴 jobs.ashbyhq.com 链接或标识",
    searchExample: "Ramp",
  },
};
