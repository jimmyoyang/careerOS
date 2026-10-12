"use server";
import { z } from "zod";
import { getCurrentUser } from "@/utils/user.utils";
import { BytedanceError, listBytedanceJobs, getBytedanceJob } from "@/lib/bytedance/client";
import { importBytedanceJob } from "@/lib/bytedance/import";
import type { BytedanceQuery } from "@/lib/bytedance/types";
import { CareerError } from "@/lib/career/errors";
import { getRecruitingProfile, RecruitingError } from "@/lib/recruiting/store";
import { resolveLogin } from "@/lib/recruiting/contracts";
import { getRecruitingDevices } from "@/lib/recruiting/bridge";
const isBytedance = (platform: string) => ["bytedance", "bytedance-campus", "字节", "字节跳动", "字节校招", "字节招聘", "字节跳动校招", "字节跳动招聘"].includes(platform.trim().toLowerCase());
async function action<T>(work: (userId: string) => Promise<T>) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "请先登录" };
    if (process.env.CAREER_ENABLED === "false") return { ok: false as const, error: "求职工作台未启用" };
    return { ok: true as const, data: await work(user.id) };
  } catch (error) {
    return { ok: false as const, error: error instanceof BytedanceError || error instanceof RecruitingError || error instanceof CareerError ? error.message : error instanceof z.ZodError ? "输入或官网字段不符合要求，请刷新后重试。" : "操作未完成，请稍后重试。现有资料和收录不受影响。" };
  }
}
export async function listBytedanceJobsAction(query: BytedanceQuery) { return action(() => listBytedanceJobs(query)); }
export async function getBytedanceJobAction(id: string) { return action(() => getBytedanceJob(id)); }
export async function importBytedanceJobAction(id: string, key: string) { return action(userId => importBytedanceJob(userId, id, key)); }
export async function getBytedanceAccountsAction() {
  return action(async userId => {
    const profile = await getRecruitingProfile(userId);
    return { revision: profile.revision, accounts: profile.data.accounts.filter(account => isBytedance(account.platform)).map(account => ({ id: account.id, label: account.label || account.platform, loginMethod: account.loginMethod, confirmed: account.confirmed })) };
  });
}
export async function previewBytedanceLoginAction(id: string, revision: number) {
  return action(async userId => {
    z.string().min(1).max(100).parse(id);
    z.number().int().nonnegative().parse(revision);
    const profile = await getRecruitingProfile(userId);
    if (profile.revision !== revision) throw new RecruitingError("资料已更新，请刷新账号列表后重新核对");
    const account = profile.data.accounts.find(item => item.id === id && isBytedance(item.platform));
    if (!account) throw new RecruitingError("请选择已保存的字节招聘账号");
    if (account.loginMethod !== "sms") throw new RecruitingError("请选择使用手机号登录的字节招聘账号");
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
