"use client";

import { PdfExportDialog } from "@/components/pdf-export/PdfExportDialog";
import type { Resume } from "@/models/profile.model";
import { settingsKey } from "@/models/pdfExport.model";
import {
  RESUME_TEMPLATE_DEFAULTS,
  type ResumeExportSettings,
} from "@/models/resumeExport.model";
import { ExportSettingsPanel } from "./export-pdf-dialog/ExportSettingsPanel";
import { canExportResume } from "./resume-container/useResumePdfExport";
import { useResumeExportSettings } from "./resume-container/useResumeExportSettings";
import { useResumePdfPreview } from "./resume-container/useResumePdfPreview";

const EMPTY_MESSAGE =
  "添加联系方式和至少一个内容模块后即可预览。";

type ExportPdfDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resume: Resume;
  onExport: (
    settings: ResumeExportSettings,
    prepared?: { blob: Blob; filename: string } | null,
  ) => void;
};

export function ExportPdfDialog({
  open,
  onOpenChange,
  resume,
  onExport,
}: ExportPdfDialogProps) {
  const { settings, setSettings, ready, reset } = useResumeExportSettings(open);
  const isDefault =
    settingsKey(settings) ===
    settingsKey(RESUME_TEMPLATE_DEFAULTS[settings.template]);

  const canExport = canExportResume(resume);
  const { blob, filename, isGenerating, error } = useResumePdfPreview(
    resume,
    settings,
    open && ready,
  );

  return (
    <PdfExportDialog
      open={open}
      onOpenChange={onOpenChange}
      title="导出 PDF"
      description="调整设置并预览后再导出文件。"
      previewLabel="简历预览"
      emptyMessage={EMPTY_MESSAGE}
      blob={blob}
      filename={filename}
      isGenerating={isGenerating}
      hasError={!!error}
      canExport={canExport}
      onExport={(prepared) => onExport(settings, prepared)}
      settingsPanel={
        <ExportSettingsPanel
          settings={settings}
          onChange={setSettings}
          onReset={reset}
          isDefault={isDefault}
        />
      }
    />
  );
}
