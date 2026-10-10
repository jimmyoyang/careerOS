"use client";

import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CreateAutomationInput } from "@/models/automation.schema";

export function StepBasics({
  form,
}: {
  form: UseFormReturn<CreateAutomationInput>;
}) {
  return (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>自动化名称</FormLabel>
            <FormControl>
              <Input placeholder="例如：上海全栈工程师岗位" {...field} />
            </FormControl>
            <FormDescription>
              使用便于识别的名称
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="jobBoard"
        render={({ field }) => (
          <FormItem>
            <FormLabel>招聘平台</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="选择招聘平台" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="greenhouse">
                  Greenhouse（公司招聘页）
                </SelectItem>
                <SelectItem value="lever">Lever（公司招聘页）</SelectItem>
                <SelectItem value="ashby">Ashby（公司招聘页）</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              跟踪指定公司的招聘页面
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}
