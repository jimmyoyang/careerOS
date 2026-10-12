"use client";

import type { UseFormReturn } from "react-hook-form";
import { Slider } from "@/components/ui/slider";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { CreateAutomationInput } from "@/models/automation.schema";

export function StepMatching({
  form,
}: {
  form: UseFormReturn<CreateAutomationInput>;
}) {
  return (
    <FormField
      control={form.control}
      name="matchThreshold"
      render={({ field }) => (
        <FormItem>
          <FormLabel>匹配阈值： {field.value}%</FormLabel>
          <FormControl>
            <Slider
              min={0}
              max={100}
              step={5}
              value={[field.value]}
              onValueChange={(value) => field.onChange(value[0])}
            />
          </FormControl>
          <FormDescription>
            仅保存 AI 匹配评分达到此阈值的岗位。低于阈值的已分析岗位会被丢弃，降低阈值可保留更多岗位。
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
