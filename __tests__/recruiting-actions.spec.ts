// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecruitingDataSchema } from "@/lib/recruiting/contracts";
vi.mock("@/utils/user.utils", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/db", () => ({ default: { resume: { findMany: vi.fn() } } }));
vi.mock("@/lib/recruiting/store", async (actual) => {
  const source = await actual<typeof import("@/lib/recruiting/store")>();
  return { ...source, getRecruitingProfile: vi.fn(), saveRecruitingProfile: vi.fn(), importRecruitingResume: vi.fn() };
});
vi.mock("@/lib/recruiting/bridge", () => ({ getRecruitingDevices: vi.fn() }));
import { getCurrentUser } from "@/utils/user.utils";
import { getRecruitingProfile, saveRecruitingProfile } from "@/lib/recruiting/store";
import { getRecruitingDevices } from "@/lib/recruiting/bridge";
import { getRecruitingProfileAction, saveRecruitingProfileAction, previewRecruitingLoginAction, getRecruitingDevicesAction } from "@/actions/recruiting.actions";
const profile = () => ({ revision: 3, data: RecruitingDataSchema.parse({
  phones: [{id:"p",number:"13800000002",deviceId:"dev-2",subscriptionId:2}],
  accounts:[{id:"a",platform:"huawei",phoneId:"p",confirmed:true}],
}) });
beforeEach(()=>{vi.resetAllMocks();});
describe("authenticated recruiting actions",()=>{
  it("rejects unauthenticated reads, writes and device enumeration",async()=>{
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await getRecruitingProfileAction()).ok).toBe(false);
    expect((await saveRecruitingProfileAction({},0)).ok).toBe(false);
    expect((await getRecruitingDevicesAction()).ok).toBe(false);
    expect(getRecruitingProfile).not.toHaveBeenCalled();
    expect(saveRecruitingProfile).not.toHaveBeenCalled();
    expect(getRecruitingDevices).not.toHaveBeenCalled();
  });
  it("uses the session owner and rejects stale login previews",async()=>{
    vi.mocked(getCurrentUser).mockResolvedValue({id:"owner"} as never);
    vi.mocked(getRecruitingProfile).mockResolvedValue(profile());
    expect((await previewRecruitingLoginAction("a",2)).ok).toBe(false);
    expect(getRecruitingProfile).toHaveBeenCalledWith("owner");
    expect(getRecruitingDevices).not.toHaveBeenCalled();
  });
  it("uses only the saved device and warns when it is unavailable",async()=>{
    vi.mocked(getCurrentUser).mockResolvedValue({id:"owner"} as never);
    vi.mocked(getRecruitingProfile).mockResolvedValue(profile());
    vi.mocked(getRecruitingDevices).mockResolvedValue([{deviceId:"other",deviceName:"其他手机",active:true}]);
    const result=await previewRecruitingLoginAction("a",3);
    expect(result.ok).toBe(true);
    if(result.ok){ expect(result.data.device).toBeNull(); expect(result.data.warning).toMatch(/设备/); expect(result.data.binding.phone).toBe("+8613800000002"); }
  });
});
