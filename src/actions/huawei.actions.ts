"use server";
import { z } from "zod";
import { getCurrentUser } from "@/utils/user.utils";
import { HuaweiError, listHuaweiJobs, getHuaweiJob } from "@/lib/huawei/client";
import { importHuaweiJob } from "@/lib/huawei/import";
import type { HuaweiQuery } from "@/lib/huawei/types";
import { CareerError } from "@/lib/career/errors";
import { getRecruitingProfile, RecruitingError } from "@/lib/recruiting/store";
import { resolveLogin } from "@/lib/recruiting/contracts";
import { getRecruitingDevices } from "@/lib/recruiting/bridge";
const isHuawei = (platform: string) => ["huawei", "huawei-campus", "华为", "华为校招", "华为招聘"].includes(platform.trim().toLowerCase());
async function action<T>(work: (userId: string) => Promise<T>) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "请先登录" };
    if (process.env.CAREER_ENABLED === "false") return { ok: false as const, error: "求职工作台未启用" };
    return { ok: true as const, data: await work(user.id) };
  } catch (error) {
    return { ok: false as const, error: error instanceof HuaweiError || error instanceof RecruitingError || error instanceof CareerError ? error.message : error instanceof z.ZodError ? "输入或官网字段不符合要求，请刷新后重试。" : "操作未完成，请稍后重试。现有资料和收录不受影响。" };
  }
}
export async function listHuaweiJobsAction(query: HuaweiQuery) { return action(() => listHuaweiJobs(query)); }
export async function getHuaweiJobAction(id: string) { return action(() => getHuaweiJob(id)); }
export async function importHuaweiJobAction(input: { advertisementId: string; intentionId: string }, key: string) { return action(userId => importHuaweiJob(userId, input, key)); }
export async function getHuaweiAccountsAction() {
  return action(async userId => {
    const profile = await getRecruitingProfile(userId);
    return { revision: profile.revision, accounts: profile.data.accounts.filter(account => isHuawei(account.platform)).map(account => ({ id: account.id, label: account.label || account.platform, loginMethod: account.loginMethod, confirmed: account.confirmed })) };
  });
}
export async function previewHuaweiLoginAction(id: string, revision: number) {
  return action(async userId => {
    z.string().min(1).max(100).parse(id);
    z.number().int().nonnegative().parse(revision);
    const profile = await getRecruitingProfile(userId);
    if (profile.revision !== revision) throw new RecruitingError("资料已更新，请刷新账号列表后重新核对");
    const account = profile.data.accounts.find(item => item.id === id && isHuawei(item.platform));
    if (!account) throw new RecruitingError("请选择已保存的华为招聘账号");
    let binding;
    try { binding = resolveLogin(profile.data, id); } catch (error) { throw new RecruitingError((error as Error).message); }
    let device = null;
    let warning = "";
    if (binding.deviceId) {
      try {
        device = (await getRecruitingDevices()).find(item => item.deviceId === binding.deviceId && item.active) ?? null;
        if (!device) warning = "绑定设备未配对或已撤销，请重新核对手机号对应的接码设备";
      } catch { warning = "接码服务未连接，后续接码前请核对设备"; }
    } else if (binding.loginMethod === "sms") warning = "手机号已确定，但尚未关联接码设备。后续接码前需要完成设备绑定";
    return { binding, device, warning };
  });
}
