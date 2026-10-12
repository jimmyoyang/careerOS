// @vitest-environment node
import fs from "node:fs";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
const ctx = await vi.hoisted(async () => {
  const { makeTestDbUrl, pushSchema } = await import("./helpers/backupTestDb");
  const value=makeTestDbUrl(); pushSchema(value.url); return value;
});
vi.mock("@/lib/db", async () => {
  const { PrismaClient }=await import("@prisma/client");
  return { default: new PrismaClient({datasources:{db:{url:ctx.url}}}) };
});
vi.mock("@/lib/scheduler", () => ({ syncSchedulerState: vi.fn() }));
import db from "@/lib/db";
import { seedAccount } from "./helpers/backupTestDb";
import { getRecruitingProfile, saveRecruitingProfile, importRecruitingResume } from "@/lib/recruiting/store";
import { RecruitingDataSchema, resolveLogin } from "@/lib/recruiting/contracts";
import { collectBackupData, buildBackupZip } from "@/lib/backup/export";
import { APP_CONSTANTS } from "@/lib/constants";
import JSZip from "jszip";
import { importBackup } from "@/lib/backup/import";
let owner: string, stranger: string;
const originalUploads=APP_CONSTANTS.UPLOADS_DIR;
beforeAll(async()=>{ (APP_CONSTANTS as {UPLOADS_DIR:string}).UPLOADS_DIR=ctx.dir; owner=await seedAccount(db,"recruit-owner@example.com"); stranger=await seedAccount(db,"recruit-other@example.com"); },30000);
afterAll(async()=>{ (APP_CONSTANTS as {UPLOADS_DIR:string}).UPLOADS_DIR=originalUploads; await db.$disconnect(); fs.rmSync(ctx.dir,{recursive:true,force:true}); });
const data=()=>RecruitingDataSchema.parse({basic:{fullName:"测试求职者"},emails:[{id:"email-1",address:"applicant@example.com"}],phones:[{id:"phone-1",number:"13800000001"}],accounts:[{id:"account-1",platform:"huawei",emailId:"email-1",phoneId:"phone-1",confirmed:true}]});
describe("recruiting profile persistence",()=>{
  it("starts empty, persists account identity and isolates users",async()=>{
    expect((await getRecruitingProfile(owner)).revision).toBe(0);
    const saved=await saveRecruitingProfile(owner,data(),0);
    expect(saved.revision).toBe(1);
    expect(resolveLogin((await getRecruitingProfile(owner)).data,"account-1").phone).toBe("+8613800000001");
    expect((await getRecruitingProfile(stranger)).data.accounts).toEqual([]);
  });
  it("rejects stale writes without losing the saved mapping",async()=>{
    await expect(saveRecruitingProfile(owner,{},0)).rejects.toThrow(/更新|刷新/);
    expect((await getRecruitingProfile(owner)).data.accounts).toHaveLength(1);
    await saveRecruitingProfile(owner,data(),1);
    await expect(saveRecruitingProfile(owner,{},1)).rejects.toThrow(/更新|刷新/);
  });
  it("does not import another user's resume",async()=>{
    const profile=await db.profile.create({data:{userId:stranger}});
    const resume=await db.resume.create({data:{profileId:profile.id,title:"私有简历"}});
    await expect(importRecruitingResume(owner,resume.id)).rejects.toThrow(/简历/);
  });
  it("imports owned resume into an editable candidate without changing saved identities",async()=>{
    const p=await db.profile.create({data:{userId:owner}});
    const resume=await db.resume.create({data:{profileId:p.id,title:"本人简历",ContactInfo:{create:{firstName:"名",lastName:"姓",headline:"工程师",email:"from-resume@example.com",phone:"13800000009"}}}});
    const imported=await importRecruitingResume(owner,resume.id);
    expect(imported.basic.fullName).toBe("姓 名");
    expect(imported.emails.some(e=>e.address==="from-resume@example.com")).toBe(true);
    expect(resolveLogin(imported,"account-1").phone).toBe("+8613800000001");
    expect((await getRecruitingProfile(owner)).data.basic.fullName).toBe("测试求职者");
  });
  it("invalidates stale pages after restoring both profile and legacy empty backups",async()=>{
    const before=await getRecruitingProfile(owner);
    const backup=await buildBackupZip(owner,"recruit-owner@example.com");
    await importBackup(backup.buffer,owner,"recruit-owner@example.com",true);
    const restored=await getRecruitingProfile(owner);
    expect(restored.revision).toBeGreaterThan(before.revision);
    await expect(saveRecruitingProfile(owner,{},before.revision)).rejects.toThrow(/更新|刷新/);
    const zip=await JSZip.loadAsync(backup.buffer);
    const raw=JSON.parse(await zip.file("data.json")!.async("string"));
    delete raw.RecruitingProfile;
    zip.file("data.json",JSON.stringify(raw));
    await importBackup(await zip.generateAsync({type:"nodebuffer"}),owner,"recruit-owner@example.com",true);
    const empty=await getRecruitingProfile(owner);
    expect(empty.data.accounts).toEqual([]);
    expect(empty.revision).toBeGreaterThan(restored.revision);
    await expect(saveRecruitingProfile(owner,data(),restored.revision)).rejects.toThrow(/更新|刷新/);
    await saveRecruitingProfile(owner,data(),empty.revision);
  });
  it("round-trips identity references through the existing backup",async()=>{
    const backup=await collectBackupData(owner);
    expect(backup.RecruitingProfile).toHaveLength(1);
    const zip=await buildBackupZip(owner,"recruit-owner@example.com");
    // Import into a fresh account; stored contact keys are document-local, not DB IDs.
    const target=await seedAccount(db,"recruit-restore@example.com");
    await importBackup(zip.buffer,target,"recruit-restore@example.com",false);
    const restored=await getRecruitingProfile(target);
    expect(resolveLogin(restored.data,"account-1").email).toBe("applicant@example.com");
    expect(restored.data.basic.fullName).toBe("测试求职者");
  });
});
