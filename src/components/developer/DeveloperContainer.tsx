"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  generateMockActivitiesAction,
  clearMockActivitiesAction,
  generateMockProfileDataAction,
  clearMockProfileDataAction,
  generateMockJobsAction,
  clearMockJobsAction,
} from "@/actions/mock.actions";

type StatusMessage = { type: "success" | "error"; text: string };

function StatusBanner({ message }: { message: StatusMessage }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        message.type === "error"
          ? "border-red-200 bg-red-50 text-red-900"
          : "border-green-200 bg-green-50 text-green-900"
      }`}
    >
      {message.type === "error" ? (
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        <p className="font-semibold">
          {message.type === "error" ? "错误" : "成功"}
        </p>
        <p className="text-sm">{message.text}</p>
      </div>
    </div>
  );
}

export function MockActivitiesCard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setMessage(null);
    const result = await generateMockActivitiesAction();
    setMessage({
      type: result.success ? "success" : "error",
      text:
        result.message ||
        (result.success
          ? "测试活动已生成"
          : "生成测试活动失败"),
    });
    setIsGenerating(false);
  };

  const handleClear = async () => {
    if (
      !confirm(
        "确定删除所有测试活动吗？此操作无法撤销。",
      )
    )
      return;

    setIsClearing(true);
    setMessage(null);
    const result = await clearMockActivitiesAction();
    setMessage({
      type: result.success ? "success" : "error",
      text:
        result.message ||
        (result.success
          ? "测试活动已清空"
          : "清空测试活动失败"),
    });
    setIsClearing(false);
  };

  return (
    <div className="space-y-4">
      {message && <StatusBanner message={message} />}
      <Card>
        <CardHeader>
          <CardTitle>测试数据管理</CardTitle>
          <CardDescription>
            生成或清空用于测试的活动数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">生成测试活动</h3>
            <p className="text-sm text-muted-foreground mb-4">
              在最近 10 天生成至少 25 条测试活动，涵盖学习、个人项目 1、个人项目 2、找工作和面试准备，每次时长为 20 至 120 分钟。
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isClearing}
              className="w-full"
            >
              {isGenerating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isGenerating ? "正在生成…" : "生成测试活动"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">清空测试活动</h3>
            <p className="text-sm text-muted-foreground mb-4">
              仅删除带有 [MOCK_DATA] 标记的测试活动，正常活动不受影响。
            </p>
            <Button
              onClick={handleClear}
              disabled={isClearing || isGenerating}
              variant="destructive"
              className="w-full"
            >
              {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isClearing ? "正在清空…" : "清空测试活动"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MockProfileCard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setMessage(null);
    const result = await generateMockProfileDataAction();
    setMessage({
      type: result.success ? "success" : "error",
      text:
        result.message ||
        (result.success
          ? "测试资料已生成"
          : "生成测试资料失败"),
    });
    setIsGenerating(false);
  };

  const handleClear = async () => {
    if (
      !confirm(
        "确定删除所有测试资料（简历、公司、地点和职位名称）吗？此操作无法撤销。",
      )
    )
      return;

    setIsClearing(true);
    setMessage(null);
    const result = await clearMockProfileDataAction();
    setMessage({
      type: result.success ? "success" : "error",
      text:
        result.message ||
        (result.success
          ? "测试资料已清空"
          : "清空测试资料失败"),
    });
    setIsClearing(false);
  };

  return (
    <div className="space-y-4">
      {message && <StatusBanner message={message} />}
      <Card>
        <CardHeader>
          <CardTitle>测试资料</CardTitle>
          <CardDescription>
            生成或清空用于测试的公司、地点、职位名称和简历
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">生成测试资料</h3>
            <p className="text-sm text-muted-foreground mb-4">
              创建 12 家科技公司、12 个美国和加拿大科技中心城市、15 种从初级到首席的技术职位，以及 8 份覆盖初级、中级和高级职级的简历。每份简历包含详细简介、多段工作经历和教育背景。使用 <code>[MOCK_DATA]</code> 前缀标记记录。
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isClearing}
              className="w-full"
            >
              {isGenerating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isGenerating ? "正在生成…" : "生成测试资料"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">清空测试资料</h3>
            <p className="text-sm text-muted-foreground mb-4">
              删除所有标题带有 <code>[MOCK_DATA]</code>标记的测试简历及其章节，再删除测试公司、地点和职位名称。真实数据不受影响。
            </p>
            <Button
              onClick={handleClear}
              disabled={isClearing || isGenerating}
              variant="destructive"
              className="w-full"
            >
              {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isClearing ? "正在清空…" : "清空测试资料"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function MockJobsCard() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setMessage(null);
    const result = await generateMockJobsAction();
    setMessage({
      type: result.success ? "success" : "error",
      text:
        result.message ||
        (result.success
          ? "测试职位已生成"
          : "生成测试职位失败"),
    });
    setIsGenerating(false);
  };

  const handleClear = async () => {
    if (
      !confirm(
        "确定删除所有测试职位吗？此操作无法撤销。",
      )
    )
      return;

    setIsClearing(true);
    setMessage(null);
    const result = await clearMockJobsAction();
    setMessage({
      type: result.success ? "success" : "error",
      text:
        result.message ||
        (result.success
          ? "测试职位已清空"
          : "清空测试职位失败"),
    });
    setIsClearing(false);
  };

  return (
    <div className="space-y-4">
      {message && <StatusBanner message={message} />}
      <Card>
        <CardHeader>
          <CardTitle>测试职位数据</CardTitle>
          <CardDescription>
            生成或清空用于测试的职位
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">生成测试职位</h3>
            <p className="text-sm text-muted-foreground mb-4">
              使用测试资料中的公司、地点、职位名称和简历，在最近 30 天生成 30 至 40 个测试职位。状态以已投递和未通过为主，包含部分面试和少量录用通知。请先生成测试资料。
            </p>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || isClearing}
              className="w-full"
            >
              {isGenerating && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isGenerating ? "正在生成…" : "生成测试职位"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">清空测试职位</h3>
            <p className="text-sm text-muted-foreground mb-4">
              仅删除带有 [MOCK_DATA] 标记的测试职位，正常职位不受影响。
            </p>
            <Button
              onClick={handleClear}
              disabled={isClearing || isGenerating}
              variant="destructive"
              className="w-full"
            >
              {isClearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isClearing ? "正在清空…" : "清空测试职位"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
