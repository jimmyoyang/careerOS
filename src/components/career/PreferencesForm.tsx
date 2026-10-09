"use client";

import { useState } from "react";
import { savePreferencesAction } from "@/actions/career";
import type { Preferences } from "@/lib/career/contracts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ActionError,
  Field,
  Section,
  selectClass,
  useCareerAction,
} from "./shared";

export function PreferencesForm({
  initialPreferences,
  onChanged,
}: {
  initialPreferences: Preferences;
  onChanged: () => Promise<void>;
}) {
  const [preferences, setPreferences] = useState(initialPreferences);
  const [message, setMessage] = useState("");
  const { run, busy, error } = useCareerAction(onChanged);
  return (
    <Section
      title="求职偏好与资格"
      description="未填写的条件会显示为未知，不会被当作满足要求。"
    >
      <ActionError message={error} />
      {message && (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {message}
        </p>
      )}
      <Field label="最高学历">
        <select
          className={selectClass}
          value={preferences.degree ?? ""}
          onChange={(event) =>
            setPreferences({
              ...preferences,
              degree: (event.target.value ||
                undefined) as Preferences["degree"],
            })
          }
        >
          <option value="">未填写</option>
          <option value="associate">大专</option>
          <option value="bachelor">本科</option>
          <option value="master">硕士</option>
          <option value="doctor">博士</option>
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ["graduationYear", "毕业年份"],
            ["daysPerWeek", "每周可到岗天数"],
            ["months", "可连续实习月数"],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <Input
              type="number"
              value={preferences[key] ?? ""}
              onChange={(event) =>
                setPreferences({
                  ...preferences,
                  [key]: event.target.value
                    ? Number(event.target.value)
                    : undefined,
                })
              }
            />
          </Field>
        ))}
      </div>
      <Field label="意向城市（逗号分隔）">
        <Input
          value={preferences.cities?.join("，") ?? ""}
          onChange={(event) =>
            setPreferences({
              ...preferences,
              cities: event.target.value.split(/[,，]/),
            })
          }
        />
      </Field>
      <Field label="意向方向">
        <Input
          value={preferences.direction ?? ""}
          onChange={(event) =>
            setPreferences({
              ...preferences,
              direction: event.target.value,
            })
          }
        />
      </Field>
      <Button
        variant="outline"
        disabled={busy}
        onClick={async () => {
          const result = await run(() =>
            savePreferencesAction({
              ...preferences,
              cities: preferences.cities
                ?.map((city) => city.trim())
                .filter(Boolean),
            }),
          );
          if (result !== undefined) setMessage("求职偏好已保存。");
        }}
      >
        保存偏好
      </Button>
    </Section>
  );
}
