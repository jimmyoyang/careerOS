# 多平台招聘工作台 Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task.

Goal: 在现有登录后 CareerOS 中落地平台中立的招聘工作台、统一搜索入口和华为风格的视觉层。

Architecture: 复用现有 Prisma/job actions 和 Profile/My Jobs 组件；以来源注册表提供多平台品牌元数据，以独立工作台和搜索页组合现有统计/职位查询能力。第三方投递仍通过原始链接完成，不新增未授权抓取或自动投递。

Tech Stack: Next.js 15 App Router、React 19、TypeScript、Tailwind CSS v4、Prisma server actions、Vitest。

Spec: docs/superpowers/specs/2026-10-10-multi-platform-career-workspace-1010-1803.md

## Global Constraints

- 保留现有手机接码登录和未提交改动。
- 搜索只查询当前用户已有职位数据。
- 未知来源回退中性样式，不能因来源缺少元数据而渲染失败。
- 新页面必须运行在登录保护的 dashboard layout 下。
- 所有新 Markdown 文件使用 Asia/Shanghai 时间戳命名。

## Review Focus

- 空状态：没有简历或职位时仍能进入搜索/简历创建动作。
- 未知来源：搜索结果和来源徽标保持可读。
- 搜索失败：输入保留并出现现有 toast 错误。
- URL 查询：Header 搜索词跳转后可被搜索页读取。
- 移动端：主搜索和来源筛选在窄屏下不溢出。

### Task 1: 来源注册表与展示组件

Files: Create src/lib/career/platforms.ts; Create src/components/career/PlatformBadge.tsx; Test __tests__/career-platforms.spec.ts

Interfaces: getPlatformMeta(source?: string | null): PlatformMeta; PlatformBadge({ source, compact? })

- [ ] Add source metadata for Huawei, ByteDance, Tencent, Alibaba, and generic fallback.
- [ ] Add tests for case-insensitive known lookup and unknown fallback.
- [ ] Render compact and regular badge variants with accessible label.

### Task 2: 统一搜索页

Files: Create src/app/dashboard/search/page.tsx; Create src/components/search/JobSearchWorkspace.tsx; Modify src/components/myjobs/JobCard.tsx; Test __tests__/job-search.spec.tsx

Interfaces: JobSearchWorkspace({ sources, locations, statuses }); client state calls getJobsList with existing filters.

- [ ] Add keyword search with 300ms debounce and source/status/location controls.
- [ ] Reuse existing JobCard details and add PlatformBadge.
- [ ] Add empty/loading/error states and link to /dashboard/myjobs.
- [ ] Verify search state updates without losing query input.

### Task 3: 登录后工作台首屏

Files: Modify src/app/dashboard/page.tsx; Create src/components/dashboard/CareerWorkspaceHero.tsx; Create src/components/dashboard/PlatformHighlights.tsx

- [ ] Add Huawei-inspired red/white hero with global search CTA.
- [ ] Add resume completion/action card and recent application highlights.
- [ ] Keep existing charts and activity calendar below the new modules.

### Task 4: Header and navigation

Files: Modify src/components/Header.tsx; Modify src/lib/constants.ts; Modify src/components/Sidebar.tsx; Test __tests__/navigation.spec.tsx

- [ ] Add compact global search that routes to /dashboard/search?q=...
- [ ] Add explicit 职位搜索 navigation item.
- [ ] Add 简历中心 wording while retaining /dashboard/profile route.
- [ ] Verify active state and mobile menu links.

### Task 5: Visual and verification pass

Files: Modify src/app/globals.css; Modify src/components/myjobs/MyJobsTable.tsx; Modify src/components/myjobs/MyJobsGrid.tsx

- [ ] Add scoped Huawei-inspired accent tokens and responsive workspace utilities.
- [ ] Apply platform badges to list/table cards.
- [ ] Run targeted Vitest, ESLint, and Next build; fix regressions.
