// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { listBytedanceJobs, getBytedanceJob } from "@/lib/bytedance/client";
const fetcher=vi.fn();
const row={id:"7667878785178552629",code:"A123",title:"软件工程师",description:"研发组件<br>完成测试<script>bad()</script>",requirement:"熟悉 C++ &amp; Python",city_info:{name:"北京"},city_list:[{name:"北京"},{name:"上海"}],job_category:{name:"后端",parent:{name:"研发"}},recruit_type:{id:"201"},job_subject:{name:{zh_cn:"2027届校园招聘"}},publish_time:1785317156317,channel_online_status:1};
const response=(data:unknown)=>new Response(JSON.stringify({code:0,data}));
function bootstrap(){return new Response(JSON.stringify({code:0,data:{token:"anonymous-token"}}),{headers:{"set-cookie":"atsx-csrf-token=anonymous-cookie; Path=/; Secure, unused=private"}});}
beforeEach(()=>{vi.stubGlobal("fetch",fetcher);fetcher.mockReset();});afterEach(()=>vi.unstubAllGlobals());
it("uses anonymous CSRF bootstrap and a fixed official campus request with safe string IDs",async()=>{
 fetcher.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(response({job_post_list:[row],count:11}));
 const result=await listBytedanceJobs({recruitmentType:"campus",keyword:"软件",page:2});
 expect(result).toMatchObject({total:11,page:2,pageSize:10});expect(result.jobs[0]).toMatchObject({id:row.id,location:"北京/上海",category:"研发 / 后端",project:"2027届校园招聘",recruitmentType:"campus"});
 expect(fetcher.mock.calls[0][0]).toBe("https://jobs.bytedance.com/api/v1/csrf/token");
 const [url,options]=fetcher.mock.calls[1];expect(url).toBe("https://jobs.bytedance.com/api/v1/search/job/posts");expect(JSON.parse(options.body)).toMatchObject({keyword:"软件",offset:10,limit:10,portal_type:3,recruitment_id_list:["201"]});expect(options.headers.Cookie).toBe("atsx-csrf-token=anonymous-cookie");expect(options.headers["x-csrf-token"]).toBe("anonymous-token");expect(options.redirect).toBe("error");
 expect(result.jobs[0].url).toBe(`https://jobs.bytedance.com/campus/position/${row.id}/detail`);
});
it.each([["internship",["202","301"]],["all",[]]] as const)("maps %s scope and preserves empty results",async(scope,ids)=>{fetcher.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(response({job_post_list:[],count:0}));expect((await listBytedanceJobs({recruitmentType:scope,keyword:"",page:1})).total).toBe(0);expect(JSON.parse(fetcher.mock.calls[1][1].body).recruitment_id_list).toEqual(ids);});
it("sanitizes descriptions while preserving official detail fields",async()=>{fetcher.mockResolvedValue(response({job_post_detail:row}));const result=await getBytedanceJob(row.id);expect(result.responsibilities).toBe("研发组件\n完成测试");expect(result.requirements).toBe("熟悉 C++ & Python");expect(fetcher.mock.calls[0][0]).toBe(`https://jobs.bytedance.com/api/v1/job/posts/${row.id}?portal_type=3`);expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty("Cookie");});
it.each(["", "https://evil.test", "1?portal_type=2", "../1"])("rejects unsafe detail ID %s before fetch",async id=>{await expect(getBytedanceJob(id)).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();});
it.each([0,-1,1.5,10001])("rejects invalid page %s before fetch",async page=>{await expect(listBytedanceJobs({recruitmentType:"campus",keyword:"",page})).rejects.toThrow();expect(fetcher).not.toHaveBeenCalled();});
it.each([{...row,id:"99"},{...row,id:7667878785178552629},{...row,channel_online_status:0},{...row,recruit_type:{id:"1"}}])("rejects mismatched, unsafe, closed or non-campus detail",async value=>{fetcher.mockResolvedValue(response({job_post_detail:value}));await expect(getBytedanceJob(row.id)).rejects.toThrow();});
it.each([new Response("blocked",{status:405}),new Response(JSON.stringify({code:100,data:null})),response({job_post_list:[],count:42}),response({job_post_list:[row],count:0})])("does not misrepresent upstream or incomplete data as zero jobs",async result=>{fetcher.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(result);await expect(listBytedanceJobs({recruitmentType:"campus",keyword:"",page:1})).rejects.toThrow();});
it("does not reuse another request's anonymous session",async()=>{fetcher.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(response({job_post_list:[],count:0})).mockResolvedValueOnce(response({token:"missing-cookie"}));await listBytedanceJobs({recruitmentType:"all",keyword:"",page:1});await expect(listBytedanceJobs({recruitmentType:"all",keyword:"",page:1})).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(3);});
it("rejects oversized response before decoding",async()=>{fetcher.mockResolvedValue(new Response("x".repeat(2100000)));await expect(getBytedanceJob(row.id)).rejects.toThrow();});
it("rejects a scope mismatch in otherwise well-formed results",async()=>{fetcher.mockResolvedValueOnce(bootstrap()).mockResolvedValueOnce(response({job_post_list:[{...row,recruit_type:{id:"202"}}],count:1}));await expect(listBytedanceJobs({recruitmentType:"campus",keyword:"",page:1})).rejects.toThrow();});
