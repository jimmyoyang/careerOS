"use client";

import { useState } from "react";
import AiSettings from "@/components/settings/AiSettings";
import ApiKeySettings from "@/components/settings/ApiKeySettings";
import DataSettings from "@/components/settings/DataSettings";
import DisplaySettings from "@/components/settings/DisplaySettings";
import McpAccessSettings from "@/components/settings/McpAccessSettings";
import SettingsSidebar, { type SettingsSection } from "@/components/settings/SettingsSidebar";
import { PageHeader } from "@/components/PageHeader";

function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>("ai-provider");

  return (
    <div className="col-span-3 min-w-0">
      <PageHeader title="设置" description="管理 AI 服务、外观、访问令牌和本地数据。" />
      <div className="flex flex-col gap-5 lg:flex-row lg:gap-8">
        <SettingsSidebar
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <div className="flex-1 min-w-0">
          {activeSection === "ai-provider" && <AiSettings />}
          {activeSection === "api-keys" && <ApiKeySettings />}
          {activeSection === "appearance" && <DisplaySettings />}
          {activeSection === "mcp-access" && <McpAccessSettings />}
          {activeSection === "data" && <DataSettings />}
        </div>
      </div>
    </div>
  );
}

export default Settings;
