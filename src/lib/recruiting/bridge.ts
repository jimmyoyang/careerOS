import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { RecruitingError } from "./store";
import type { BridgeDevice } from "./contracts";

export async function getRecruitingDevices(): Promise<BridgeDevice[]> {
  const stateDir = process.env.PHONE_BRIDGE_STATE_DIR;
  if (!stateDir || !path.isAbsolute(stateDir)) throw new RecruitingError("尚未配置接码设备连接，可以先保存资料和账号绑定");
  try {
    const credential = (await readFile(path.join(stateDir, "admin-token"), "utf8")).trim();
    if (!/^[A-Za-z0-9_-]{32,256}$/.test(credential)) throw new Error("Invalid credential");
    const response = await fetch("http://127.0.0.1:4738/v1/devices", {
      headers: { Authorization: `Bearer ${credential}` },
      cache: "no-store", signal: AbortSignal.timeout(3000), redirect: "error",
    });
    if (!response.ok) throw new Error("Bridge unavailable");
    const parsed = z.object({ devices: z.array(z.object({ deviceId: z.string().max(100), deviceName: z.string().max(160), active: z.boolean() })).max(100) }).parse(await response.json());
    return parsed.devices;
  } catch { throw new RecruitingError("接码服务未连接。可以保存资料；使用接码前请启动 Bridge 并核对设备"); }
}
