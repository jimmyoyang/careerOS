"use client";

import { Bot, Database, Key, Palette, Plug } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export type SettingsSection = "ai-provider" | "api-keys" | "appearance" | "mcp-access" | "data";

const SETTINGS_SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: typeof Bot;
}[] = [
  { id: "ai-provider", label: "AI 服务商", icon: Bot },
  { id: "api-keys", label: "API 密钥", icon: Key },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "mcp-access", label: "MCP 访问", icon: Plug },
  { id: "data", label: "数据", icon: Database },
];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export default function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <nav className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto rounded-2xl border border-border/60 bg-card/70 p-1 lg:w-52 lg:flex-col">
      {SETTINGS_SECTIONS.map((section) => {
        const Icon = section.icon;
        const isActive = activeSection === section.id;
        return (
          <Button
            key={section.id}
            variant="ghost"
            className={cn(
              "justify-start gap-2 rounded-xl border-l-0 text-left lg:border-l-2",
              isActive
                ? "border-primary bg-primary/10 font-medium text-primary lg:border-l-primary"
                : "border-transparent hover:bg-muted/70 lg:border-l-transparent lg:hover:border-l-muted-foreground/25",
            )}
            onClick={() => onSectionChange(section.id)}
          >
            <Icon className="h-4 w-4" />
            {section.label}
          </Button>
        );
      })}
    </nav>
  );
}
