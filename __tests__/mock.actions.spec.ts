import {
  clearMockActivitiesAction,
  clearMockJobsAction,
  generateMockJobsAction,
} from "@/actions/mock.actions";
import prisma from "@/lib/db";
import { requireUser } from "@/actions/shared";
import { MOCK_DATA_IDENTIFIER } from "@/lib/data/mockActivities";

vi.mock("@/lib/db", () => ({
  default: {
    activity: { findMany: vi.fn(), deleteMany: vi.fn() },
    job: { findMany: vi.fn(), deleteMany: vi.fn() },
    company: { count: vi.fn() },
  },
}));
vi.mock("@/actions/shared", () => ({ requireUser: vi.fn() }));
vi.mock("@/lib/jobs/createJobRecord", () => ({ createFirstStage: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "development");
  vi.mocked(requireUser).mockResolvedValue({ id: "user-1" } as any);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it("reports the deleted count in Chinese while retaining the mock-data deletion filter", async () => {
  vi.mocked(prisma.activity.findMany).mockResolvedValue([{ id: "mock-1" }] as any);
  vi.mocked(prisma.activity.deleteMany).mockResolvedValue({ count: 1 });

  const result = await clearMockActivitiesAction();

  expect(prisma.activity.findMany).toHaveBeenCalledWith({
    where: { userId: "user-1", description: { contains: MOCK_DATA_IDENTIFIER } },
  });
  expect(prisma.activity.deleteMany).toHaveBeenCalledWith({
    where: { id: { in: ["mock-1"] } },
  });
  expect(result).toEqual({ success: true, message: "已删除 1 条测试活动", deletedCount: 1 });
});

it("keeps the development-mode guard and reports it in Chinese", async () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.spyOn(console, "error").mockImplementation(() => {});

  expect(await clearMockActivitiesAction()).toEqual({
    success: false,
    message: "仅开发模式支持清空测试数据",
  });
  expect(prisma.activity.findMany).not.toHaveBeenCalled();
});

it("explains the profile-data prerequisite before generating jobs", async () => {
  vi.mocked(prisma.company.count).mockResolvedValue(0);
  expect(await generateMockJobsAction()).toEqual({
    success: false,
    message: "请先生成测试资料（需要公司、地点、职位名称和简历）。",
  });
});

it("does not delete anything when there are no mock jobs", async () => {
  vi.mocked(prisma.job.findMany).mockResolvedValue([]);
  expect(await clearMockJobsAction()).toEqual({
    success: true,
    message: "没有可删除的测试职位。",
  });
  expect(prisma.job.findMany).toHaveBeenCalledWith({
    where: { userId: "user-1", description: { contains: MOCK_DATA_IDENTIFIER } },
    select: { id: true },
  });
  expect(prisma.job.deleteMany).not.toHaveBeenCalled();
});
