"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Loader2, Plus, Trash2, Copy, Check } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  createMcpToken,
  listMcpTokens,
  revokeMcpToken,
  type PublicTokenMeta,
} from "@/actions/mcpToken.actions";
import { APP_CONSTANTS } from "@/lib/constants";
import { format } from "date-fns";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toastError("无法复制到剪贴板，请手动复制文本。", "复制失败");
    }
  };
  return (
    <Button aria-label={copied ? "已复制" : "复制"} variant="outline" size="sm" onClick={copy} className="shrink-0">
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

function CodeSnippet({ label, code }: { label: string; code: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <div className="flex gap-2 items-start">
        <pre className="flex-1 bg-muted rounded-sm p-2 text-xs overflow-x-auto whitespace-pre-wrap break-all">{code}</pre>
        <CopyButton text={code} />
      </div>
    </div>
  );
}

function TokenRevealDialog({
  token,
  tokenName,
  mcpUrl,
  onClose,
}: {
  token: string;
  tokenName: string;
  mcpUrl: string;
  onClose: () => void;
}) {
  const ocSnippet = JSON.stringify(
    {
      mcpServers: {
        jobsync: {
          type: "streamable-http",
          url: mcpUrl,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );

  const isInsecureNonLocalhost = (() => {
    try {
      const { protocol, hostname } = new URL(mcpUrl);
      return protocol === "http:" && hostname !== "localhost" && hostname !== "127.0.0.1";
    } catch {
      return false;
    }
  })();

  const claudeSnippet = `npx mcp-remote ${mcpUrl} --header "Authorization: Bearer ${token}"${
    isInsecureNonLocalhost ? " --allow-http" : ""
  }`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>令牌已创建，请立即保存</DialogTitle>
          <DialogDescription>
            完整令牌仅显示这一次，请在关闭前复制保存。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">您的令牌</Label>
            <div className="flex gap-2 items-center">
              <Input readOnly value={token} className="font-mono text-xs" />
              <CopyButton text={token} />
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">客户端配置示例</p>
            <CodeSnippet label="OpenClaw / Hermes (streamable-http)" code={ocSnippet} />
            <CodeSnippet label="Claude Desktop（通过 mcp-remote）" code={claudeSnippet} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>我已保存令牌</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function McpAccessSettings() {
  const [tokens, setTokens] = useState<PublicTokenMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [expiryDays, setExpiryDays] = useState<30 | 90 | 365>(
    APP_CONSTANTS.MCP_TOKEN_EXPIRY_DEFAULT_DAYS as 30 | 90 | 365,
  );

  const [revealedToken, setRevealedToken] = useState<{ token: string; name: string } | null>(null);

  const mcpUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/mcp`
      : "/api/mcp";

  const fetchTokens = async () => {
    setIsLoading(true);
    const result = await listMcpTokens();
    setTokens(result);
    setIsLoading(false);
  };

  useEffect(() => { fetchTokens(); }, []);

  const handleGenerate = async () => {
    if (!tokenName.trim()) return;
    setGenerating(true);
    const result = await createMcpToken({ name: tokenName.trim(), expiryDays });
    setGenerating(false);
    if (!result.success) {
      toastError(result.message);
      return;
    }
    setRevealedToken({ token: result.token, name: result.record.name });
    setShowGenerateDialog(false);
    setTokenName("");
    setExpiryDays(APP_CONSTANTS.MCP_TOKEN_EXPIRY_DEFAULT_DAYS as 30 | 90 | 365);
    await fetchTokens();
  };

  const handleRevoke = async (id: string) => {
    setRevoking(id);
    const result = await revokeMcpToken(id);
    setRevoking(null);
    if (!result.success) {
      toastError(result.message ?? "撤销失败");
      return;
    }
    setTokens((prev) => prev.filter((t) => t.id !== id));
    toastSuccess("令牌已撤销");
  };

  return (
    <div className="space-y-6">
      {revealedToken && (
        <TokenRevealDialog
          token={revealedToken.token}
          tokenName={revealedToken.name}
          mcpUrl={mcpUrl}
          onClose={() => setRevealedToken(null)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">MCP 接口</CardTitle>
          <CardDescription>通过模型上下文协议（MCP）将 AI 助手连接到 JobSync。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">接口地址</Label>
            <div className="flex gap-2 items-center">
              <Input readOnly value={mcpUrl} className="font-mono text-sm" />
              <CopyButton text={mcpUrl} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-lg font-medium">个人访问令牌</CardTitle>
            <CardDescription>令牌用于验证外部 AI 助手调用 MCP 工具的权限。</CardDescription>
          </div>
          <Button size="sm" className="shrink-0" onClick={() => setShowGenerateDialog(true)} disabled={isLoading}>
            <Plus className="h-4 w-4 mr-1" />
            生成
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在加载令牌…
            </div>
          ) : tokens.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无 MCP 令牌，请先生成一个。</p>
          ) : (
            <div className="space-y-3">
              {tokens.map((t) => (
                <div key={t.id} className="flex items-start justify-between border rounded-sm p-3 gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{t.tokenPrefix}…</p>
                    <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                      <span>创建于 {format(new Date(t.createdAt), "yyyy年M月d日")}</span>
                      <span>到期时间 {format(new Date(t.expiresAt), "yyyy年M月d日")}</span>
                      {t.lastUsedAt && <span>最近使用 {format(new Date(t.lastUsedAt), "yyyy年M月d日")}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {t.scopes.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={revoking === t.id} title="撤销令牌">
                        {revoking === t.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>撤销“{t.name}”？</AlertDialogTitle>
                        <AlertDialogDescription>
                          使用此令牌的 AI 助手将立即失去访问权限，此操作无法撤销。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRevoke(t.id)}>撤销</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>生成 MCP 令牌</DialogTitle>
            <DialogDescription>
              请使用客户端名称（如 ChatGPT、Hermes、Claude Desktop）为令牌命名。通过此令牌创建的岗位会将该名称显示为来源。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>令牌名称</Label>
              <Input
                placeholder="例如 Claude Desktop"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              />
            </div>
            <div className="space-y-2">
              <Label>有效期</Label>
              <Select
                value={String(expiryDays)}
                onValueChange={(v) => setExpiryDays(Number(v) as 30 | 90 | 365)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_CONSTANTS.MCP_TOKEN_EXPIRY_PRESETS.map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} 天</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>取消</Button>
            <Button onClick={handleGenerate} disabled={generating || !tokenName.trim()}>
              {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              生成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
