import { Metadata } from "next";
import {
  MockActivitiesCard,
  MockProfileCard,
  MockJobsCard,
} from "@/components/developer/DeveloperContainer";

export const metadata: Metadata = {
  title: "开发者选项 | CareerOS",
  description: "开发模式下使用的工具",
};

export default function DeveloperPage() {
  return (
    <>
      <div className="col-span-3">
        <h1 className="text-3xl font-bold tracking-tight">开发者选项</h1>
        <p className="text-muted-foreground mt-2">
          开发与测试工具，仅在开发模式下可用。
        </p>
      </div>
      <div className="col-start-1 self-start">
        <MockActivitiesCard />
      </div>
      <div className="col-start-2 self-start">
        <MockProfileCard />
      </div>
      <div className="col-start-3 self-start">
        <MockJobsCard />
      </div>
    </>
  );
}
