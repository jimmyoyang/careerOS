// @vitest-environment node
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, beforeEach, expect, it, vi } from "vitest";
import { seedAccount } from "./helpers/backupTestDb";
const ctx = await vi.hoisted(async () => { const h = await import("./helpers/backupTestDb"); const c = h.makeTestDbUrl(); h.pushSchema(c.url); return c; });
vi.mock("@/lib/db", async () => { const { PrismaClient } = await import("@prisma/client"); return { default: new PrismaClient({ datasources: { db: { url: ctx.url } } }) }; });
vi.mock("@/lib/huawei/client", async actual => ({ ...await actual<typeof import("@/lib/huawei/client")>(), getHuaweiJob: vi.fn() }));
import db from "@/lib/db";
import { getHuaweiJob } from "@/lib/huawei/client";
import { importHuaweiJob } from "@/lib/huawei/import";
const detail = { advertisementId:"36384",title:"AI工程师",location:"上海",category:"研发",recruitmentType:"campus" as const,updatedAt:"2026-08-17",url:"https://career.huawei.com/cn/job-details?advertisementId=36384",responsibilities:"请您详见岗位意向中的岗位职责",requirements:"请您详见岗位意向中的岗位要求",intentions:[{id:"11583",title:"算子技术",responsibilities:"开发组件",requirements:"掌握 C++",location:"上海",departments:"研究院"},{id:"11584",title:"编译器",responsibilities:"开发编译器",requirements:"掌握 LLVM",location:"北京",departments:"研究院"}] };
let owner:string; let other:string;
beforeAll(async()=>{owner=await seedAccount(db,"huawei@example.com");other=await seedAccount(db,"other@example.com");});
afterAll(async()=>{await db.$disconnect();fs.rmSync(ctx.dir,{recursive:true,force:true});});
beforeEach(()=>{vi.mocked(getHuaweiJob).mockResolvedValue(structuredClone(detail));});
it("imports verified direction, preserves unknown cohort and deadline, and assigns source",async()=>{
 const result=await importHuaweiJob(owner,{advertisementId:"36384",intentionId:"11583"},randomUUID());
 const job=await db.job.findUniqueOrThrow({where:{id:result.jobId},include:{careerContext:true,JobSource:true}});
 expect(job.JobSource?.value).toBe("huawei-campus"); expect(job.careerContext?.cohort).toBe(""); expect(job.dueDate).toBeNull();
 expect(job.careerContext?.rawJd).toContain("掌握 C++"); expect(job.careerContext?.rawJd).not.toContain("请您详见"); expect(job.jobUrl).toContain("positionIntentionId=11583");
});
it("deduplicates same direction across retries and changed descriptions, keeps different directions and owners",async()=>{
 const input={advertisementId:"36384",intentionId:"11583"}; const key=randomUUID();
 const first=await importHuaweiJob(owner,input,key); const replay=await importHuaweiJob(owner,input,key); expect(replay.jobId).toBe(first.jobId);
 vi.mocked(getHuaweiJob).mockResolvedValue({...detail,intentions:detail.intentions.map(i=>({...i,requirements:"更新要求"}))});
 expect((await importHuaweiJob(owner,input,key)).jobId).toBe(first.jobId);
 const dup=await importHuaweiJob(owner,input,randomUUID()); expect(dup).toEqual({jobId:first.jobId,duplicate:true,schemaVersion:1});
 expect((await importHuaweiJob(owner,{...input,intentionId:"11584"},randomUUID())).jobId).not.toBe(first.jobId);
 expect((await importHuaweiJob(other,input,randomUUID())).jobId).not.toBe(first.jobId);
});
it("rejects missing, foreign and placeholder directions without writing a job",async()=>{
 const count=await db.job.count();
 await expect(importHuaweiJob(owner,{advertisementId:"36384",intentionId:"999"},randomUUID())).rejects.toThrow();
 vi.mocked(getHuaweiJob).mockResolvedValue({...detail,intentions:[]});
 await expect(importHuaweiJob(owner,{advertisementId:"36384",intentionId:""},randomUUID())).rejects.toThrow();
 vi.mocked(getHuaweiJob).mockResolvedValue({...detail,intentions:[{...detail.intentions[0],requirements:"请您详见岗位意向中的岗位要求"}]});
 await expect(importHuaweiJob(owner,{advertisementId:"36384",intentionId:"11583"},randomUUID())).rejects.toThrow();
 expect(await db.job.count()).toBe(count);
});
it("rejects invalid idempotency keys and IDs before fetching",async()=>{vi.mocked(getHuaweiJob).mockClear();await expect(importHuaweiJob(owner,{advertisementId:"36384",intentionId:"11583"},"bad")).rejects.toThrow();expect(getHuaweiJob).not.toHaveBeenCalled();});
