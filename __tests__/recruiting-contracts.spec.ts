import { describe, expect, it } from "vitest";
import { RecruitingDataSchema, resolveLogin, normalizePhone } from "@/lib/recruiting/contracts";
const profile = () => RecruitingDataSchema.parse({
  emails: [{ id: "e1", address: "one@example.com" }, { id: "e2", address: "two@example.com" }],
  phones: [{ id: "p1", number: "13800000001" }, { id: "p2", number: "13800000002", deviceId: "device-2", subscriptionId: 2 }],
  accounts: [{ id: "a1", platform: "huawei", label: "华为主账号", emailId: "e1", phoneId: "p2", loginMethod: "sms", confirmed: true },
    { id: "a2", platform: "huawei", label: "另一个账号", emailId: "e2", phoneId: "p1", loginMethod: "sms", confirmed: true }],
});
describe("recruiting identity mappings", () => {
  it("resolves exactly the selected account's phone, email and SIM", () => {
    expect(resolveLogin(profile(), "a1")).toMatchObject({ phone: "+8613800000002", email: "one@example.com", deviceId: "device-2", subscriptionId: 2, loginIdentifier: "+8613800000002" });
    expect(resolveLogin(profile(), "a2").phone).toBe("+8613800000001");
  });
  it("does not fall back to another phone or account", () => {
    const data=profile(); data.accounts[0].phoneId="";
    expect(() => resolveLogin(data,"a1")).toThrow(/手机号/);
    expect(() => resolveLogin(data,"missing")).toThrow(/账号/);
  });
  it("requires explicit confirmation and an email for email login", () => {
    const data=profile(); data.accounts[0].confirmed=false;
    expect(() => resolveLogin(data,"a1")).toThrow(/核对/);
    data.accounts[0].confirmed=true; data.accounts[0].loginMethod="email"; data.accounts[0].emailId="";
    expect(() => resolveLogin(data,"a1")).toThrow(/邮箱/);
  });
  it("rejects dangling references and duplicate contacts", () => {
    const data=profile(); data.phones.pop();
    expect(RecruitingDataSchema.safeParse(data).success).toBe(false);
    const duplicate=profile(); duplicate.emails[1].address="ONE@example.com";
    expect(RecruitingDataSchema.safeParse(duplicate).success).toBe(false);
    const repeated=profile(); repeated.accounts[1].id="a1";
    expect(RecruitingDataSchema.safeParse(repeated).success).toBe(false);
  });
  it("normalizes numbers without mixing country codes", () => {
    expect(normalizePhone("+86", "138 0000 0001")).toBe("+8613800000001");
    expect(normalizePhone("+86", "+86 13800000001")).toBe("+8613800000001");
    expect(() => normalizePhone("+86", "+1 2025550101")).toThrow();
    expect(() => normalizePhone("+86", "abc")).toThrow();
  });
  it("accepts empty draft sections but validates dates and SIM numbers", () => {
    expect(RecruitingDataSchema.parse({}).education).toEqual([]);
    expect(RecruitingDataSchema.safeParse({ basic: { birthDate: "2026-02-31" } }).success).toBe(false);
    const data=profile(); data.phones[1].subscriptionId=-1;
    expect(RecruitingDataSchema.safeParse(data).success).toBe(false);
  });
});
