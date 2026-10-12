"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerDownload } from "@/components/pdf-export/download";
import { toastError, toastSuccess } from "@/lib/toast";
import type { Resume } from "@/models/profile.model";
import {
  defaultResumeExportSettings,
  type ResumeExportSettings,
} from "@/models/resumeExport.model";

// The one rule for what counts as an exportable resume. The dialog reads it to
// disable Export up front; the hook keeps it as its own safety net.
export function canExportResume(resume: Resume): boolean {
  const hasName = Boolean(
    resume.ContactInfo?.firstName?.trim() ||
      resume.ContactInfo?.lastName?.trim(),
  );
  const hasSections = Boolean(
    resume.ResumeSections?.some(
      (s) =>
        s.summary?.content ||
        s.workExperiences?.length ||
        s.educations?.length ||
        s.licenseOrCertifications?.length ||
        s.skills?.length,
    ),
  );
  return hasName || hasSections;
}

// Owns PDF export: generating the blob, downloading it, and the follow-up
// prompt when the resume already has a file attached.
export function useResumePdfExport(resume: Resume) {
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);
  const [pendingPdf, setPendingPdf] = useState<{
    blob: Blob;
    filename: string;
  } | null>(null);
  const [showAttachConfirm, setShowAttachConfirm] = useState(false);

  const uploadPdfAsAttachment = async (
    blob: Blob,
    filename: string,
    replaceExisting: boolean,
  ) => {
    const formData = new FormData();
    formData.append(
      "file",
      new File([blob], filename, { type: "application/pdf" }),
    );
    formData.append("title", resume.title);
    formData.append("id", resume.id!);
    if (replaceExisting && resume.FileId) {
      formData.append("fileId", resume.FileId);
    }
    const res = await fetch("/api/profile/resume", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) throw new Error("上传失败");
    router.refresh();
  };

  const handleExportPdf = async (
    settings: ResumeExportSettings = defaultResumeExportSettings,
    prepared?: { blob: Blob; filename: string } | null,
  ) => {
    if (!canExportResume(resume)) {
      toastError(
        "请先添加联系方式和至少一个内容模块（个人简介、工作经历或教育经历），再导出。",
        "暂无可导出的内容",
      );
      return;
    }

    setIsExporting(true);
    try {
      // The dialog hands back the blob already on screen; generating is the
      // fallback for a failed preview or a caller with no preview at all.
      let output = prepared;
      if (!output) {
        const { generateResumePdfBlob } = await import("../resume-pdf");
        output = await generateResumePdfBlob(resume, settings);
      }
      const { blob, filename } = output;

      if (!resume.FileId) {
        triggerDownload(blob, filename);
        await uploadPdfAsAttachment(blob, filename, false);
        toastSuccess("已保存到下载文件夹，并添加为此简历的附件。", "PDF 已导出");
      } else {
        setPendingPdf({ blob, filename });
        setShowAttachConfirm(true);
      }
    } catch {
      toastError("生成 PDF 失败，请重试。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleAttachChoice = async (choice: "replace" | "download-only") => {
    if (!pendingPdf) return;
    setShowAttachConfirm(false);
    setIsExporting(true);
    try {
      const { blob, filename } = pendingPdf;
      triggerDownload(blob, filename);
      if (choice === "replace") {
        await uploadPdfAsAttachment(blob, filename, true);
        toastSuccess("已保存到下载文件夹，并替换原有附件。", "PDF 已导出");
      } else {
        toastSuccess("已保存到下载文件夹。", "PDF 已导出");
      }
    } catch {
      toastError("上传 PDF 失败，请重试。");
    } finally {
      setIsExporting(false);
      setPendingPdf(null);
    }
  };

  const cancelAttach = () => {
    setShowAttachConfirm(false);
    setPendingPdf(null);
  };

  return {
    isExporting,
    showAttachConfirm,
    setShowAttachConfirm,
    handleExportPdf,
    handleAttachChoice,
    cancelAttach,
  };
}
