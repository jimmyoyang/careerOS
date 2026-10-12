export type HuaweiRecruitmentType = "campus" | "internship";
export type HuaweiQuery = { recruitmentType: HuaweiRecruitmentType; keyword: string; page: number };
export type HuaweiJob = { advertisementId: string; title: string; location: string; category: string; recruitmentType: HuaweiRecruitmentType; updatedAt: string; url: string };
export type HuaweiIntention = { id: string; title: string; responsibilities: string; requirements: string; location: string; departments: string };
export type HuaweiDetail = HuaweiJob & { responsibilities: string; requirements: string; intentions: HuaweiIntention[] };
export type HuaweiPage = { jobs: HuaweiJob[]; total: number; page: number; pageSize: number; fetchedAt: string };
