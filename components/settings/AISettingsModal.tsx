"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  Save,
  Trash2,
  X
} from "lucide-react";
import {
  AIClientConfig,
  EMPTY_AI_CONFIG,
  LLMClientProvider,
  PROVIDER_DEFAULT_BASE_URLS,
  clearAIConfig,
  isAIConfigComplete,
  loadAIConfig,
  resolveEffectiveBaseUrl,
  saveAIConfig
} from "@/lib/ai/config-client";
import { callLLMStatus } from "@/lib/ai/client-bridge";

type Preset = {
  label: string;
  provider: LLMClientProvider;
  baseUrl: string;
  model: string;
  hint?: string;
  signupUrl?: string;
};

const PRESETS: Preset[] = [
  {
    label: "DeepSeek",
    provider: "openai",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
    hint: "中文好、价格低、响应快",
    signupUrl: "https://platform.deepseek.com"
  },
  {
    label: "OpenAI",
    provider: "openai",
    baseUrl: "https://api.openai.com",
    model: "gpt-4o-mini",
    signupUrl: "https://platform.openai.com/api-keys"
  },
  {
    label: "Claude (Anthropic)",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-20250514",
    hint: "原生 Anthropic Messages API",
    signupUrl: "https://console.anthropic.com"
  },
  {
    label: "Gemini (Google)",
    provider: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-2.5-flash",
    hint: "原生 Google AI Studio",
    signupUrl: "https://aistudio.google.com/apikey"
  },
  {
    label: "通义千问 (DashScope)",
    provider: "openai",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    model: "qwen-plus",
    signupUrl: "https://dashscope.console.aliyun.com"
  },
  {
    label: "智谱 BigModel",
    provider: "openai",
    baseUrl: "https://open.bigmodel.cn/api/paas",
    model: "glm-4-flash",
    signupUrl: "https://open.bigmodel.cn"
  },
  {
    label: "Kimi (月之暗面)",
    provider: "openai",
    baseUrl: "https://api.moonshot.cn",
    model: "moonshot-v1-8k",
    signupUrl: "https://platform.moonshot.cn"
  },
  {
    label: "OpenRouter",
    provider: "openai",
    baseUrl: "https://openrouter.ai/api",
    model: "openai/gpt-4o-mini",
    hint: "聚合 100+ 模型",
    signupUrl: "https://openrouter.ai/keys"
  },
  {
    label: "Groq",
    provider: "openai",
    baseUrl: "https://api.groq.com/openai",
    model: "llama-3.3-70b-versatile",
    hint: "超快推理",
    signupUrl: "https://console.groq.com/keys"
  },
  {
    label: "SiliconFlow",
    provider: "openai",
    baseUrl: "https://api.siliconflow.cn",
    model: "deepseek-ai/DeepSeek-V3",
    hint: "国产模型聚合",
    signupUrl: "https://cloud.siliconflow.cn"
  },
  {
    label: "Ollama (本地)",
    provider: "openai",
    baseUrl: "http://localhost:11434",
    model: "llama3.1",
    hint: "本机模型，无需 key（任意填）"
  },
  {
    label: "自定义",
    provider: "openai",
    baseUrl: "",
    model: "",
    hint: "任何 OpenAI 兼容服务"
  }
];

const PROVIDER_LABELS: Record<LLMClientProvider, string> = {
  openai: "OpenAI 兼容（含 DeepSeek / Kimi / 通义 / Groq / Ollama 等绝大多数）",
  anthropic: "Anthropic Messages（Claude 全系）",
  gemini: "Google Gemini（Gemini 1.5 / 2.x 全系）"
};

type AISettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; model: string; baseUrl: string; source: string }
  | { status: "error"; message: string };

export function AISettingsModal({ open, onClose }: AISettingsModalProps) {
  const [config, setConfig] = useState<AIClientConfig>(EMPTY_AI_CONFIG);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showTavily, setShowTavily] = useState(false);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [savedHint, setSavedHint] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setConfig(loadAIConfig());
      setTest({ status: "idle" });
      setSavedHint(null);
      setShowApiKey(false);
      setShowTavily(false);
    }
  }, [open]);

  // 打开时锁定 body 滚动，避免背景滚动透出
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!savedHint) return;
    const handle = window.setTimeout(() => setSavedHint(null), 2400);
    return () => window.clearTimeout(handle);
  }, [savedHint]);

  if (!open || !mounted) return null;

  function update<K extends keyof AIClientConfig>(
    key: K,
    value: AIClientConfig[K]
  ) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: Preset) {
    setConfig((current) => ({
      ...current,
      llmProvider: preset.provider,
      llmBaseUrl: preset.baseUrl,
      llmModel: preset.model
    }));
  }

  function handleSave() {
    saveAIConfig(config);
    setSavedHint("已保存到本机浏览器");
  }

  function handleClear() {
    clearAIConfig();
    setConfig(EMPTY_AI_CONFIG);
    setSavedHint("已清空");
    setTest({ status: "idle" });
  }

  async function handleTest() {
    setTest({ status: "testing" });
    try {
      const data = await callLLMStatus();
      if (!data.available) {
        throw new Error(
          data.error ?? "当前配置检测为不可用：请检查 base_url / api_key / model"
        );
      }
      setTest({
        status: "ok",
        model: data.model ?? "",
        baseUrl: data.baseUrl ?? "",
        source: data.source ?? "client"
      });
    } catch (err) {
      setTest({ status: "error", message: (err as Error).message });
    }
  }

  const complete = isAIConfigComplete(config);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 px-4 py-6 animate-modal-backdrop"
      onMouseDown={() => setIsDragging(false)}
      onMouseMove={(e) => {
        if (e.buttons === 1) setIsDragging(true);
      }}
      onClick={(event) => {
        if (!isDragging && event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-surface shadow-panel animate-modal-panel">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <div className="text-[10px] font-semibold tracking-[0.18em] text-slate-500">
              AI 设置
            </div>
            <h2 className="mt-1 text-base font-semibold text-text-main">
              填入你自己的 LLM API Key
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-slate-500"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
            🔒 你的 API Key 仅保存在本机浏览器（localStorage），通过 HTTP
            header 一次性发到本项目自己的 /api/* 后端去调真正的 LLM。后端不会写入磁盘 / 数据库 / 日志。
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-slate-500">
              快速预设（点一下自动填 provider / base_url / model）
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="flex flex-col items-start gap-1 rounded-xl border border-border bg-white px-2.5 py-2 text-left text-xs text-slate-700 transition hover:border-primary hover:bg-primary-soft/40"
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    {preset.label}
                    <span className="rounded bg-slate-100 px-1 py-0 text-[9px] font-normal uppercase tracking-wider text-slate-500">
                      {preset.provider}
                    </span>
                  </span>
                  {preset.hint ? (
                    <span className="text-[10px] text-slate-500">
                      {preset.hint}
                    </span>
                  ) : null}
                  {preset.signupUrl ? (
                    <a
                      href={preset.signupUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-0.5 text-[10px] text-primary hover:underline"
                    >
                      申请 Key
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          <Field label="协议（Provider）">
            <select
              value={config.llmProvider}
              onChange={(event) =>
                update("llmProvider", event.target.value as LLMClientProvider)
              }
              className={inputClass}
            >
              {(
                [
                  "openai",
                  "anthropic",
                  "gemini"
                ] as LLMClientProvider[]
              ).map((p) => (
                <option key={p} value={p}>
                  {p} — {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="LLM Base URL（可选，留空时按 model 名自动识别）">
            <input
              value={config.llmBaseUrl}
              onChange={(event) => update("llmBaseUrl", event.target.value)}
              placeholder={
                PROVIDER_DEFAULT_BASE_URLS[config.llmProvider] ||
                "https://api.deepseek.com"
              }
              className={inputClass}
              autoComplete="off"
            />
            {!config.llmBaseUrl.trim() && resolveEffectiveBaseUrl(config) ? (
              <div className="mt-1 text-[10px] text-emerald-600">
                将自动使用：
                <span className="font-mono">{resolveEffectiveBaseUrl(config)}</span>
              </div>
            ) : null}
            {!config.llmBaseUrl.trim() &&
            !resolveEffectiveBaseUrl(config) &&
            config.llmModel.trim() ? (
              <div className="mt-1 text-[10px] text-amber-600">
                未识别该 model 对应的服务，请手动填 base_url（例如
                <span className="font-mono"> https://api.deepseek.com</span>）
              </div>
            ) : null}
          </Field>

          <Field label="LLM API Key">
            <div className="relative">
              <input
                value={config.llmApiKey}
                onChange={(event) => update("llmApiKey", event.target.value)}
                placeholder="sk-xxxxxxxx"
                className={`${inputClass} pr-10`}
                type={showApiKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                aria-label={showApiKey ? "隐藏" : "显示"}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </Field>

          <Field label="LLM Model">
            <input
              value={config.llmModel}
              onChange={(event) => update("llmModel", event.target.value)}
              placeholder="deepseek-chat / gpt-4o-mini / qwen-plus"
              className={inputClass}
              autoComplete="off"
            />
          </Field>

          <details className="rounded-2xl border border-border bg-slate-50/50 p-3 text-xs">
            <summary className="cursor-pointer text-[11px] font-semibold tracking-[0.16em] text-slate-500">
              可选：Tavily（开放网页检索 API Key）
            </summary>
            <div className="mt-3">
              <Field label="Tavily API Key">
                <div className="relative">
                  <input
                    value={config.tavilyApiKey}
                    onChange={(event) =>
                      update("tavilyApiKey", event.target.value)
                    }
                    placeholder="不填则只用 arXiv 检索"
                    className={`${inputClass} pr-10`}
                    type={showTavily ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTavily((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                    aria-label={showTavily ? "隐藏" : "显示"}
                  >
                    {showTavily ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </Field>
              <a
                href="https://app.tavily.com"
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-[10px] text-primary hover:underline"
              >
                免费申请（每月 1000 次）
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </details>

          {test.status === "ok" ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700">
              ✅ 连接成功：model=<span className="font-mono">{test.model}</span>
              ，base_url=<span className="font-mono">{test.baseUrl}</span>
              （来源：{test.source === "client" ? "本机配置" : "环境变量"}）
            </div>
          ) : null}
          {test.status === "error" ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
              ❌ {test.message}
            </div>
          ) : null}
          {savedHint ? (
            <div className="rounded-xl border border-primary/30 bg-primary-soft/40 px-3 py-2 text-[11px] text-primary">
              {savedHint}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            onClick={handleClear}
            className="flex h-9 items-center gap-1 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-600 hover:text-rose-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            清空
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleTest}
              disabled={!complete || test.status === "testing"}
              className="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-white px-3 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {test.status === "testing" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              测试连接
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!complete}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-primary px-4 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-3.5 w-3.5" />
              保存
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const inputClass =
  "h-10 w-full rounded-xl border border-border bg-white px-3 text-sm text-text-main outline-none placeholder:text-slate-400 focus:border-primary";

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[11px] font-semibold tracking-[0.16em] text-slate-500">
        {label}
      </div>
      {children}
    </label>
  );
}
