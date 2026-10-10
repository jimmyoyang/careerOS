import { JOB_SOURCES as DEFAULT_JOB_SOURCES } from "@/lib/constants";

const LEGACY_JOB_SOURCE_IDS: Record<string, string> = {
  indeed: "1359dac4-a397-4461-b747-382706dcbe79",
  linkedin: "a483e678-6e3d-41cf-8c6f-6540b02551eb",
  monster: "8d941ed0-6882-4d88-b985-d614e9828576",
  glassdoor: "49a9a222-d5ac-452b-88d8-7258e2e58c07",
  careerpage: "08642cf8-29f5-4535-ad58-63edbbace13f",
  google: "090eefe1-2f99-46d1-925f-d59e0e8f072c",
  ziprecruiter: "c0ae0c56-beed-471c-b7d3-4eb1f732fe8f",
  jobstreet: "108537a8-1d84-4bc3-8820-4a1cd71c5ccf",
  other: "ddd8aa2e-37c1-4dc8-b370-a844ff1ad82c",
};

// AddJob uses the same seed list as signup. The UI-only fields keep this mock
// data compatible with the JobSource shape without maintaining a second list.
export const JOB_SOURCES = DEFAULT_JOB_SOURCES.map((source, index) => ({
  id: LEGACY_JOB_SOURCE_IDS[source.value] ?? `default-job-source-${index + 1}`,
  label: source.label,
  value: source.value,
  createdBy: "",
}));
