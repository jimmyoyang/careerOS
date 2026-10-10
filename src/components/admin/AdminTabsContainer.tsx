"use client";
import ActivityTypesContainer from "@/components/admin/ActivityTypesContainer";
import CompaniesContainer from "@/components/admin/CompaniesContainer";
import ContactRolesContainer from "@/components/admin/ContactRolesContainer";
import ContactsContainer from "@/components/admin/ContactsContainer";
import JobLocationsContainer from "@/components/admin/JobLocationsContainer";
import JobSourcesContainer from "@/components/admin/JobSourcesContainer";
import JobStagesContainer from "@/components/admin/JobStagesContainer";
import JobTitlesContainer from "@/components/admin/JobTitlesContainer";
import TagsContainer from "@/components/admin/TagsContainer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

function AdminTabsContainer() {
  const router = useRouter();
  const pathname = usePathname();
  const queryParams = useSearchParams();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(queryParams.toString());
      params.set(name, value);

      return params.toString();
    },
    [queryParams],
  );

  const onTabChange = (tab: string) => {
    router.push(pathname + "?" + createQueryString("tab", tab));
  };
  return (
    <Tabs
      defaultValue={queryParams.get("tab") || "companies"}
      onValueChange={(e) => onTabChange(e)}
    >
      <TabsList className="w-full justify-start overflow-x-auto">
        <TabsTrigger value="companies">公司</TabsTrigger>
        <TabsTrigger value="job-titles">职位名称</TabsTrigger>
        <TabsTrigger value="locations">地点</TabsTrigger>
        <TabsTrigger value="sources">来源</TabsTrigger>
        <TabsTrigger value="skills">技能</TabsTrigger>
        <TabsTrigger value="activity-types">活动类型</TabsTrigger>
        <TabsTrigger value="contacts">联系人</TabsTrigger>
        <TabsTrigger value="roles">角色</TabsTrigger>
        <TabsTrigger value="stages">阶段</TabsTrigger>
      </TabsList>
      <TabsContent value="companies">
        <CompaniesContainer />
      </TabsContent>
      <TabsContent value="job-titles">
        <JobTitlesContainer />
      </TabsContent>
      <TabsContent value="locations">
        <JobLocationsContainer />
      </TabsContent>
      <TabsContent value="sources">
        <JobSourcesContainer />
      </TabsContent>
      <TabsContent value="skills">
        <TagsContainer />
      </TabsContent>
      <TabsContent value="activity-types">
        <ActivityTypesContainer />
      </TabsContent>
      <TabsContent value="contacts">
        <ContactsContainer />
      </TabsContent>
      <TabsContent value="roles">
        <ContactRolesContainer />
      </TabsContent>
      <TabsContent value="stages">
        <JobStagesContainer />
      </TabsContent>
    </Tabs>
  );
}

export default AdminTabsContainer;
