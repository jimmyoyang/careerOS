"use client";

import { zhMessage } from "@/lib/i18n/zh-CN";
import { useCallback, useEffect, useState } from "react";
import {
  AiModel,
  AiProvider,
  defaultModel,
  OpenaiModel,
  DeepseekModel,
  GeminiModel,
} from "@/models/ai.model";
import {
  PROVIDER_REGISTRY,
  AI_PROVIDERS,
} from "@/lib/ai/provider-registry";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { toastSuccess, toastError } from "@/lib/toast";
import { XCircle, Loader2, RefreshCw } from "lucide-react";
import { checkOllamaConnection } from "@/utils/ai.utils";
import { getUserSettings, updateAiSettings } from "@/actions/userSettings.actions";
import { useAgentChat } from "@/components/agent/AgentChatProvider";

function AiSettings() {
  const { isOpen: isAgentChatOpen, refreshPreflight } = useAgentChat();
  const [selectedModel, setSelectedModel] = useState<AiModel>(defaultModel);
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [fetchError, setFetchError] = useState<string>("");
  const [connectionError, setConnectionError] = useState<string>("");


  const setSelectedProvider = (provider: AiProvider) => {
    setSelectedModel({ provider, model: undefined });
    setFetchError("");
    setConnectionError("");
  };

  const setSelectedProviderModel = (model: string) => {
    setSelectedModel({ ...selectedModel, model });
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const settingsResult = await getUserSettings();

        if (settingsResult.success && settingsResult.data?.settings?.ai) {
          const aiSettings = settingsResult.data.settings.ai;
          setSelectedModel({
            provider: aiSettings.provider || defaultModel.provider,
            model: aiSettings.model,
          });
        }
      } catch (error) {
        console.error("Error fetching user settings:", error);
      } finally {
        setIsLoadingSettings(false);
        setIsInitialized(true);
      }
    };
    fetchSettings();
  }, []);

  const getFallbackModels = (provider: AiProvider): string[] => {
    switch (provider) {
      case AiProvider.OPENAI:
        return Object.values(OpenaiModel);
      case AiProvider.DEEPSEEK:
        return Object.values(DeepseekModel);
      case AiProvider.GEMINI:
        return Object.values(GeminiModel);
      default:
        return [];
    }
  };

  const fetchModelsForProvider = useCallback(
    (provider: AiProvider) => {
      const entry = PROVIDER_REGISTRY[provider];
      if (!entry) return () => {};

      if (!entry.modelsEndpoint) {
        const fallbackModels = getFallbackModels(provider);
        setFetchedModels(fallbackModels);
        setSelectedModel((prev) =>
          prev.model && !fallbackModels.includes(prev.model)
            ? { ...prev, model: undefined }
            : prev,
        );
        return () => {};
      }

      const fallback = getFallbackModels(provider);
      let cancelled = false;
      setIsLoadingModels(true);
      setFetchError("");
      setConnectionError("");

      (async () => {
        try {
          if (entry.category === "local") {
            const connResult = await checkOllamaConnection(provider);
            if (!connResult.isConnected) {
              if (!cancelled) {
                setFetchedModels(fallback);
                setConnectionError(connResult.error || "无法连接到 Ollama。");
              }
              return;
            }
          }
          const response = await fetch(`/api/ai/${entry.modelsEndpoint}`);
          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            const errorMsg = errorData?.error
              || (entry.category === "local"
                ? `无法获取 ${entry.displayName} 模型。请确认 ${entry.displayName} 正在运行。`
                : `无法获取 ${entry.displayName} 模型。请在 API 密钥设置中检查您的 API 密钥。`);
            if (!cancelled) {
              setFetchError(errorMsg);
              setFetchedModels(fallback);
            }
            return;
          }
          const data = await response.json();
          const models = entry.parseModelsResponse?.(data) ?? [];
          const finalModels = models.length > 0 ? models : fallback;
          if (!cancelled) {
            setFetchedModels(finalModels);
            setSelectedModel((prev) =>
              prev.model && !finalModels.includes(prev.model)
                ? { ...prev, model: undefined }
                : prev,
            );
          }
        } catch (error) {
          console.error(`Error fetching ${entry.displayName} models:`, error);
          if (!cancelled) {
            setFetchedModels(fallback);
            setFetchError(
              entry.category === "local"
                ? `无法获取 ${entry.displayName} 模型。请确认 ${entry.displayName} 正在运行。`
                : `无法获取 ${entry.displayName} 模型。请在 API 密钥设置中检查您的 API 密钥。`,
            );
          }
        } finally {
          if (!cancelled) setIsLoadingModels(false);
        }
      })();

      return () => { cancelled = true; };
    },
    [],
  );

  useEffect(() => {
    if (!isInitialized) return;
    return fetchModelsForProvider(selectedModel.provider);
  }, [selectedModel.provider, isInitialized, fetchModelsForProvider]);

  const retryConnection = () => {
    fetchModelsForProvider(selectedModel.provider);
  };

  const saveModelSettings = async () => {
    if (!selectedModel.model) {
      toastError("请先选择模型再保存。");
      return;
    }
    setIsSaving(true);
    try {
      const result = await updateAiSettings({
        provider: selectedModel.provider,
        model: selectedModel.model,
      });
      if (result.success) {
        toastSuccess("AI 设置已保存。", "已保存");
        if (isAgentChatOpen) void refreshPreflight();
      } else {
        toastError(result.message || "保存 AI 设置失败。");
      }
    } catch (error) {
      console.error("Error saving AI settings:", error);
      toastError("保存 AI 设置失败。");
    } finally {
      setIsSaving(false);
    }
  };

  // Radix reads an undefined value as uncontrolled and falls back to its own
  // internal state, which still holds the previous provider's pick; a value
  // matching no item renders neither item text nor placeholder.
  const modelValue =
    selectedModel.model && fetchedModels.includes(selectedModel.model)
      ? selectedModel.model
      : "";

  if (isLoadingSettings) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">AI 服务商</h3>
          <p className="text-sm text-muted-foreground">
            配置 AI 服务商和模型。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在加载设置…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">AI 服务商</h3>
        <p className="text-sm text-muted-foreground">
          配置 AI 服务商和模型。
        </p>
      </div>
      <div>
        <Label className="my-4" htmlFor="ai-provider">
          AI 服务商
        </Label>
        <Select
          value={selectedModel.provider}
          onValueChange={setSelectedProvider}
        >
          <SelectTrigger
            id="ai-provider"
            aria-label="选择 AI 服务商"
            className="w-[180px]"
          >
            <SelectValue placeholder="选择 AI 服务商" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {AI_PROVIDERS.map((id) => {
                const entry = PROVIDER_REGISTRY[id];
                return (
                  <SelectItem key={id} value={id}>
                    {entry.displayName}
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="my-4" htmlFor="ai-model">
          模型
        </Label>
        <div className="flex flex-wrap items-start gap-2">
          <Select
            value={isLoadingModels ? "" : modelValue}
            onValueChange={setSelectedProviderModel}
            disabled={isLoadingModels}
          >
            <SelectTrigger
              id="ai-model"
              aria-label="选择模型"
              className="w-[180px]"
            >
              {/* a flex row here must nest inside SelectValue's span, which the
                  trigger's [&>span]:line-clamp-1 outranks */}
              <SelectValue
                placeholder={
                  isLoadingModels ? (
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      正在加载模型…
                    </span>
                  ) : (
                    "选择模型"
                  )
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {fetchedModels.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {fetchError && (
            <div className="flex items-start gap-1 text-red-600 text-sm mt-2">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{zhMessage(fetchError)}</span>
            </div>
          )}
          {connectionError && (
            <div className="flex items-start gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 shrink-0 text-muted-foreground"
                onClick={retryConnection}
                disabled={isLoadingModels}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoadingModels ? "animate-spin" : ""}`} />
                重试
              </Button>
              <div className="flex items-start gap-1 text-red-600 text-sm">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{zhMessage(connectionError)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <Button
        className="mt-4"
        onClick={saveModelSettings}
        disabled={!selectedModel.model || isLoadingModels || isSaving}
      >
        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        保存
      </Button>
    </div>
  );
}

export default AiSettings;
