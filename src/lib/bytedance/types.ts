export type BytedanceRecruitmentType = "campus" | "internship";
export type BytedanceQuery = { recruitmentType: BytedanceRecruitmentType | "all"; keyword: string; page: number };
export type BytedanceJob = { id: string; code: string; title: string; location: string; category: string; recruitmentType: BytedanceRecruitmentType; project: string; publishedAt: string; url: string };
export type BytedanceDetail = BytedanceJob & { responsibilities: string; requirements: string };
export type BytedancePage = { jobs: BytedanceJob[]; total: number; page: number; pageSize: number; fetchedAt: string };
