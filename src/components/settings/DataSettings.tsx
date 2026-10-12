"use client";

import { zhLabel } from "@/lib/i18n/zh-CN";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, History, Loader2, Upload } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { toastError, toastSuccess } from "@/lib/toast";

interface PreflightResult {
  manifest: {
    formatVersion: number;
    appVersion: string;
    exportedAt: string;
    sourceEmail: string;
    counts: Record<string, number>;
  };
  emailMatches: boolean;
  targetIsEmpty: boolean;
  targetCounts: Record<string, number>;
}

interface SnapshotInfo {
  id: string;
  exportedAt: string;
  appVersion: string;
  counts: Record<string, number>;
  sizeBytes: number;
}

function CountGrid({ counts }: { counts: Record<string, number> }) {
  const rows = Object.entries(counts).filter(([, n]) => n > 0);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">无。</p>;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
      {rows.map(([model, n]) => (
        <div key={model} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{zhLabel(model)}</span>
          <span className="font-medium tabular-nums">{n}</span>
        </div>
      ))}
    </div>
  );
}

export default function DataSettings() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<File | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [restoring, setRestoring] = useState<SnapshotInfo | null>(null);

  const loadSnapshots = useCallback(async () => {
    try {
      const res = await fetch("/api/backup/snapshots");
      if (res.ok) setSnapshots((await res.json()) as SnapshotInfo[]);
    } catch {
      // A failed list is not worth a toast — the card just stays empty.
    }
  }, []);

  useEffect(() => {
    void loadSnapshots();
  }, [loadSnapshots]);

  const runRollback = async () => {
    if (!restoring) return;
    const snapshotId = restoring.id;
    setRestoring(null);
    setBusy(true);
    try {
      const res = await fetch("/api/backup/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshotId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error, "回滚失败");
        return;
      }
      toastSuccess(
        "数据已回滚，刷新页面即可查看。",
        "回滚完成",
      );
      await loadSnapshots();
    } catch {
      toastError("无法连接到服务器。", "回滚失败");
    } finally {
      setBusy(false);
    }
  };

  const destroyed = preflight
    ? Object.entries(preflight.targetCounts).filter(([, n]) => n > 0)
    : [];

  const onSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setPreflight(null);
    setSelected(file);
    if (!file) return;

    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/backup/import/preflight", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error, "无法读取备份");
        return;
      }
      setPreflight(json as PreflightResult);
    } catch {
      toastError("无法连接到服务器。", "无法读取备份");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    if (!selected) return;
    setConfirming(false);
    setBusy(true);
    try {
      const body = new FormData();
      body.append("file", selected);
      body.append("confirmWipe", "true");
      const res = await fetch("/api/backup/import", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) {
        toastError(json.error, "导入失败");
        return;
      }
      const total = Object.values(json.counts as Record<string, number>).reduce(
        (sum, n) => sum + n,
        0,
      );
      // Naming the snapshot is the whole point of taking one — a safety net
      // the user does not know exists is not a safety net.
      toastSuccess(
        `已恢复 ${total} 条记录和 ${json.filesWritten} 个文件。${
          json.snapshotPath
            ? "此前的数据已保存为快照，可在下方恢复。"
            : ""
        } 请重新输入 AI 服务商的 API 密钥、重新生成 MCP 令牌，并刷新页面。`,
        "导入完成",
      );
      setPreflight(null);
      setSelected(null);
      if (fileInput.current) fileInput.current.value = "";
      await loadSnapshots();
    } catch {
      toastError("无法连接到服务器。", "导入失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">导出数据</CardTitle>
          <CardDescription>
            下载一个 ZIP 文件，包含此账号的全部岗位、简历、任务、活动和问题，以及已上传的简历文件。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            文件中 <strong>不含 API 密钥</strong>、MCP 令牌或密码，但会包含所有岗位描述、笔记和简历的
            <strong> 完整内容</strong> ，请妥善保管。
          </p>
          <Button asChild>
            <a href="/api/backup/export" download>
              <Download className="mr-2 h-4 w-4" />
              下载备份
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">导入备份</CardTitle>
          <CardDescription>
            使用备份内容替换此账号中的所有数据。API 密钥和 MCP 令牌会保留，AI 助手聊天记录将被清空。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backup-file">备份文件</Label>
            <Input
              id="backup-file"
              ref={fileInput}
              type="file"
              accept=".zip,application/zip"
              onChange={onSelect}
              disabled={busy}
            />
          </div>

          {busy && !preflight && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在读取备份…
            </p>
          )}

          {preflight && (
            <div className="space-y-3 rounded-md border p-4">
              <div className="text-sm">
                <p>
                  导出时间{" "}
                  {format(new Date(preflight.manifest.exportedAt), "yyyy年M月d日 HH:mm")} 来自 JobSync {preflight.manifest.appVersion}
                </p>
                <p className="text-muted-foreground">
                  来源账号： {preflight.manifest.sourceEmail}
                </p>
              </div>

              {!preflight.emailMatches && (
                <p className="rounded-sm bg-destructive/10 p-2 text-sm font-medium text-destructive">
                  此备份来自其他账号（{preflight.manifest.sourceEmail}）。导入仍会清空当前登录账号的数据。
                </p>
              )}

              <div>
                <p className="mb-1 text-sm font-medium">备份内容</p>
                <CountGrid counts={preflight.manifest.counts} />
              </div>

              <Button
                variant="destructive"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Upload className="mr-2 h-4 w-4" />
                使用此备份替换我的数据
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">撤销导入</CardTitle>
            <CardDescription>
              每次导入前都会保存原有数据。如果导入了错误的文件，可恢复导入前的快照。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshots.map((snapshot) => (
              <div
                key={snapshot.id}
                className="flex items-center justify-between gap-4 rounded-md border p-3"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {format(new Date(snapshot.exportedAt), "yyyy年M月d日 HH:mm")}
                  </p>
                  <p className="text-muted-foreground">
                    {snapshot.counts.Job ?? 0} 个岗位， {snapshot.counts.Resume ?? 0}{" "}
                    份简历 · {(snapshot.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setRestoring(snapshot)}
                >
                  <History className="mr-2 h-4 w-4" />
                  恢复
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>回滚到此快照？</AlertDialogTitle>
            <AlertDialogDescription>
              此账号中的全部数据将替换为以下时间的快照数据：{" "}
              {restoring && format(new Date(restoring.exportedAt), "yyyy年M月d日 HH:mm")}。回滚前会先保存当前状态的快照，因此本次操作也可以撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={runRollback}>
              回滚
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除此账号的数据？</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  此操作无法撤销。以下数据将被永久删除，并替换为备份内容：
                </p>
                <ul className="list-inside list-disc text-sm">
                  {destroyed.map(([model, n]) => (
                    <li key={model}>
                      {n} 条{zhLabel(model)}
                    </li>
                  ))}
                  {destroyed.length === 0 && <li>无，此账号尚无数据</li>}
                </ul>
                {preflight && !preflight.emailMatches && (
                  <p className="font-medium text-destructive">
                    此备份来自其他账号。
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive-bg text-destructive-foreground hover:bg-destructive-bg/90"
              onClick={runImport}
            >
              删除全部数据并导入
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
