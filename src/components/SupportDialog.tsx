"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { AppVersionInfo } from "@/models/version.model";
import packageJson from "../../package.json";

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  version?: AppVersionInfo | null;
}

export function SupportDialog({
  open,
  onOpenChange,
  version,
}: SupportDialogProps) {
  const appVersion = packageJson.version;
  const currentYear = new Date().getFullYear();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>帮助与支持</DialogTitle>
          <DialogDescription className="space-y-1">
            <a
              href="https://github.com/Gsync/jobsync/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary hover:underline"
            >
              https://github.com/Gsync/jobsync/issues
            </a>
            <a
              href="https://github.com/Gsync/jobsync/discussions"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-primary hover:underline"
            >
              https://github.com/Gsync/jobsync/discussions
            </a>
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">版本</h3>
            <p className="text-sm text-muted-foreground">v{appVersion}</p>
            {version?.updateAvailable && (
              <p className="text-sm">
                <a
                  href={version.releaseUrl ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {version.latest} 可更新
                </a>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">版权</h3>
            <p className="text-sm text-muted-foreground">
              © {currentYear} JobSync。保留所有权利。
            </p>
            <a
              href="https://jobsync.ca/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              https://jobsync.ca/
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
