import { getPlatformMeta } from "@/lib/career/platforms";

describe("career platform registry", () => {
  it("does not misidentify custom sources containing a platform name", () => {
    expect(getPlatformMeta("not-huawei").key).toBe("other");
    expect(getPlatformMeta(" 华为校招 ").key).toBe("huawei-campus");
    expect(getPlatformMeta("constructor").key).toBe("other");
  });
  it("normalizes known source values", () => {
    expect(getPlatformMeta("Huawei-campus").label).toBe("华为校招");
    expect(getPlatformMeta("BYTEDANCE").label).toBe("字节跳动");
    expect(getPlatformMeta("tencent-campus").accent).toBe("#1677ff");
  });

  it("keeps unknown sources readable with a neutral fallback", () => {
    const meta = getPlatformMeta("Acme careers");
    expect(meta.label).toBe("Acme careers");
    expect(meta.key).toBe("other");
    expect(meta.accent).toBe("#2563eb");
  });
});
