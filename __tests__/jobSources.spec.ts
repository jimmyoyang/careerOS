import { JOB_SOURCES } from "@/lib/constants";

describe("default job sources", () => {
  it("includes the major Chinese internet campus recruitment sources", () => {
    const labels = new Set(JOB_SOURCES.map((source) => source.label));

    const expectedLabels = [
      "腾讯校招",
      "阿里巴巴校招",
      "蚂蚁集团校招",
      "淘天集团校招",
      "字节跳动校招",
      "百度校招",
      "京东校招",
      "美团校招",
      "拼多多校招",
      "小米校招",
      "网易校招",
      "快手校招",
      "哔哩哔哩校招",
      "滴滴校招",
      "携程校招",
      "小红书校招",
      "知乎校招",
      "贝壳校招",
      "华为校招",
      "OPPO校招",
      "vivo校招",
      "荣耀校招",
      "科大讯飞校招",
      "大疆校招",
      "商汤科技校招",
      "米哈游校招",
      "网易游戏校招",
    ];

    expectedLabels.forEach((label) => expect(labels).toContain(label));
  });

  it("keeps source values unique", () => {
    const values = JOB_SOURCES.map((source) => source.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
