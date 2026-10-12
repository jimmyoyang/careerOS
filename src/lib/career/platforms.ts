export type PlatformMeta = {
  key: string;
  label: string;
  shortLabel: string;
  accent: string;
  surface: string;
};

const PLATFORM_META: Record<string, PlatformMeta> = {
  huawei: {
    key: "huawei",
    label: "华为",
    shortLabel: "华",
    accent: "#cf0a2c",
    surface: "#fff1f3",
  },
  "huawei-campus": {
    key: "huawei-campus",
    label: "华为校招",
    shortLabel: "华",
    accent: "#cf0a2c",
    surface: "#fff1f3",
  },
  bytedance: {
    key: "bytedance",
    label: "字节跳动",
    shortLabel: "字",
    accent: "#111827",
    surface: "#f3f4f6",
  },
  "bytedance-campus": {
    key: "bytedance-campus",
    label: "字节跳动校招",
    shortLabel: "字",
    accent: "#111827",
    surface: "#f3f4f6",
  },
  tencent: {
    key: "tencent",
    label: "腾讯",
    shortLabel: "腾",
    accent: "#1677ff",
    surface: "#eff6ff",
  },
  "tencent-campus": {
    key: "tencent-campus",
    label: "腾讯校招",
    shortLabel: "腾",
    accent: "#1677ff",
    surface: "#eff6ff",
  },
  alibaba: {
    key: "alibaba",
    label: "阿里巴巴",
    shortLabel: "阿",
    accent: "#ff6a00",
    surface: "#fff7ed",
  },
  "alibaba-campus": {
    key: "alibaba-campus",
    label: "阿里巴巴校招",
    shortLabel: "阿",
    accent: "#ff6a00",
    surface: "#fff7ed",
  },
};

const FALLBACK: PlatformMeta = {
  key: "other",
  label: "其他来源",
  shortLabel: "源",
  accent: "#2563eb",
  surface: "#eff6ff",
};

function normalizeSource(source: string) {
  return source.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function getPlatformMeta(source?: string | null): PlatformMeta {
  if (!source) return FALLBACK;
  const normalized = normalizeSource(source);
  const direct = Object.hasOwn(PLATFORM_META, normalized) ? PLATFORM_META[normalized] : undefined;
  if (direct) return direct;

  const entry = Object.entries(PLATFORM_META).find(([, meta]) =>
    normalizeSource(meta.label) === normalized,
  );
  return entry?.[1] ?? { ...FALLBACK, label: source.trim() || FALLBACK.label };
}

export const CAREER_PLATFORM_KEYS = Object.keys(PLATFORM_META);
