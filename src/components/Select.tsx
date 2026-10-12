import { zhLabel } from "@/lib/i18n/zh-CN";
import React from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { FormControl } from "./ui/form";
import { ControllerRenderProps } from "react-hook-form";

interface SelectProps {
  label: string;
  options: any[];
  field: ControllerRenderProps<any, any>;
  translateOptions?: boolean;
}

function SelectFormCtrl({ label, options, field, translateOptions = false }: SelectProps) {
  return (
    <>
      <Select
        onValueChange={field.onChange}
        value={field.value}
        name={field.name}
      >
        <FormControl>
          <SelectTrigger aria-label={`选择${zhLabel(label)}`} className="w-[200px]">
            <SelectValue placeholder={`选择${zhLabel(label)}`} />
          </SelectTrigger>
        </FormControl>
        <SelectContent>
          <SelectGroup>
            {options &&
              options.map((option) => {
                return (
                  <SelectItem key={option.id} value={option.id}>
                    {translateOptions ? zhLabel(option.label ?? option.value ?? option.title) : (option.label ?? option.value ?? option.title)}
                  </SelectItem>
                );
              })}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}

export default SelectFormCtrl;
