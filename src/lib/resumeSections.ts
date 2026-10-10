import { APP_CONSTANTS } from "@/lib/constants";

export const hasMinResumeSections = (
  sectionCount: number | null | undefined,
): boolean =>
  (sectionCount ?? 0) >= APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;

export const buildInsufficientSectionsMessage = (
  action: string,
  hint?: string,
): string => {
  const min = APP_CONSTANTS.MIN_RESUME_SECTIONS_FOR_SELECTION;
  return `请先添加至少 ${min} 个内容模块${hint ? `（${hint}）` : ""}，再${action}。`;
};
