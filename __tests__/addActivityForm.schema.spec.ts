import { AddActivityFormSchema } from "@/models/addActivityForm.schema";

// A picked calendar date is local midnight; an untouched default carries the
// current time. Both shapes are exercised below.
const NOW = new Date(2026, 7, 12, 9, 5, 30);
const today = () => new Date(NOW);
const yesterdayMidnight = () => new Date(2026, 7, 11);
const todayMidnight = () => new Date(2026, 7, 12);
const tomorrowMidnight = () => new Date(2026, 7, 13);

const base = {
  activityName: "Job Search",
  activityType: "research",
};

const parse = (input: Record<string, unknown>) =>
  AddActivityFormSchema.safeParse({ ...base, ...input });

const errorFor = (result: ReturnType<typeof parse>, field: string) =>
  result.success
    ? undefined
    : result.error.issues.find((issue) => issue.path[0] === field)?.message;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("AddActivityFormSchema", () => {
  it("accepts the form defaults", () => {
    const result = parse({
      startDate: today(),
      startTime: "09:05 AM",
      endDate: today(),
      endTime: "09:10 AM",
    });

    expect(result.success).toBe(true);
  });

  it("names the field when the activity type is missing", () => {
    const result = parse({
      activityType: "",
      startDate: today(),
      startTime: "09:05 AM",
      endDate: today(),
      endTime: "09:10 AM",
    });

    expect(errorFor(result, "activityType")).toBe(
      "请选择活动类型。"
    );
  });

  it("accepts a same-day entry when the end date came from the calendar", () => {
    const result = parse({
      startDate: today(),
      startTime: "09:05 AM",
      endDate: todayMidnight(),
      endTime: "09:10 AM",
    });

    expect(errorFor(result, "endDate")).toBeUndefined();
    expect(result.success).toBe(true);
  });

  it("rejects an end time before the start time on the same day", () => {
    const result = parse({
      startDate: todayMidnight(),
      startTime: "05:00 PM",
      endDate: today(),
      endTime: "09:00 AM",
    });

    expect(errorFor(result, "endTime")).toBe(
      "结束时间必须晚于开始时间。"
    );
  });

  it("rejects an end date before the start date", () => {
    const result = parse({
      startDate: tomorrowMidnight(),
      startTime: "09:00 AM",
      endDate: todayMidnight(),
      endTime: "10:00 AM",
    });

    expect(errorFor(result, "endDate")).toBe(
      "结束日期不能早于开始日期。"
    );
  });

  it("accepts an activity that runs past midnight", () => {
    const result = parse({
      startDate: yesterdayMidnight(),
      startTime: "11:00 PM",
      endDate: todayMidnight(),
      endTime: "01:00 AM",
    });

    expect(result.success).toBe(true);
  });

  it("rejects a duration longer than the maximum", () => {
    const result = parse({
      startDate: todayMidnight(),
      startTime: "01:00 AM",
      endDate: todayMidnight(),
      endTime: "11:00 AM",
    });

    expect(errorFor(result, "endTime")).toContain("不能超过 8 小时");
  });

  it("rejects a duration shorter than the minimum", () => {
    const result = parse({
      startDate: todayMidnight(),
      startTime: "09:00 AM",
      endDate: todayMidnight(),
      endTime: "09:01 AM",
    });

    expect(errorFor(result, "endTime")).toBe(
      "活动时长至少需要 2 分钟"
    );
  });

  it("rejects a start date/time in the future", () => {
    const result = parse({
      startDate: today(),
      startTime: "09:06 AM",
      endDate: today(),
      endTime: "09:30 AM",
    });

    expect(errorFor(result, "startTime")).toBe(
      "开始时间不能晚于当前时间。"
    );
  });
});
