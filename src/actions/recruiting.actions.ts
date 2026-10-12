"use server";
import { z } from "zod";
import db from "@/lib/db";
import { getCurrentUser } from "@/utils/user.utils";
import { getRecruitingProfile, saveRecruitingProfile, importRecruitingResume, RecruitingError } from "@/lib/recruiting/store";
import { getRecruitingDevices } from "@/lib/recruiting/bridge";
import { resolveLogin } from "@/lib/recruiting/contracts";

async function action<T>(work: (userId: string) => Promise<T>) {
  try {
    const user = await getCurrentUser();
    if (!user) return { ok: false as const, error: "请先登录" };
    return { ok: true as const, data: await work(user.id) };
  } catch (error) {
    return { ok: false as const, error: error instanceof z.ZodError ? error.issues.map((i) => i.message).slice(0, 3).join("；") : error instanceof RecruitingError ? error.message : "操作未完成，请稍后重试。现有资料未被清空" };
  }
}
export async function getRecruitingProfileAction() { return action(getRecruitingProfile); }
export async function saveRecruitingProfileAction(input: unknown, expectedRevision: number) { return action((userId) => saveRecruitingProfile(userId, input, expectedRevision)); }
export async function getRecruitingDevicesAction() { return action(() => getRecruitingDevices()); }
export async function getRecruitingResumesAction() {
  return action((userId) => db.resume.findMany({ where: { profile: { userId } }, select: { id: true, title: true }, orderBy: { updatedAt: "desc" } }));
}
export async function importRecruitingResumeAction(resumeId: string) { return action((userId) => importRecruitingResume(userId, resumeId)); }
export async function previewRecruitingLoginAction(accountId: string, expectedRevision: number) {
  return action(async (userId) => {
    const profile = await getRecruitingProfile(userId);
    if (profile.revision !== expectedRevision) throw new RecruitingError("资料已更新，请刷新后重新核对");
    let binding;
    try { binding = resolveLogin(profile.data, accountId); } catch (error) { throw new RecruitingError((error as Error).message); }
    let device = null;
    let warning = "";
    if (binding.deviceId) {
      try {
        const devices = await getRecruitingDevices();
        device = devices.find((item) => item.deviceId === binding.deviceId && item.active) ?? null;
        if (!device) warning = "绑定设备未配对或已撤销，请重新核对手机号对应的接码设备";
      } catch (error) { warning = (error as Error).message; }
    } else if (binding.loginMethod === "sms") warning = "手机号已确定，但尚未关联接码设备。后续接码前需要完成设备绑定";
    return { binding, device, warning };
  });
}
