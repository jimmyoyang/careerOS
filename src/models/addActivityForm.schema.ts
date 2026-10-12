import { APP_CONSTANTS } from "@/lib/constants";
import { combineDateAndTime } from "@/lib/utils";
import { differenceInMinutes, startOfDay } from "date-fns";
import { z } from "zod";

export const AddActivityFormSchema = z
  .object({
    id: z.string().optional(),
    userId: z.string().optional(),
    activityName: z
      .string({
        error: "请填写活动名称。",
      })
      .min(2, {
        message: "活动名称至少需要 2 个字符。",
      }),
    activityType: z.string().min(1, {
      message: "请选择活动类型。",
    }),
    startDate: z.date(),
    startTime: z
      .string()
      .regex(
        /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
        "开始时间格式应为 hh:mm AM/PM。"
      ),
    endDate: z.date().optional(),
    endTime: z
      .string()
      .regex(
        /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/,
        "结束时间格式应为 hh:mm AM/PM。"
      )
      .optional(),
    duration: z
      .number()
      .min(0, "时长必须大于零。")
      .optional(),
    description: z
      .string()
      .max(1000, {
        message: "描述不能超过 1000 个字符。",
      })
      .optional(),
  })
  // Compare calendar days only: a picked date is local midnight while an
  // untouched default carries the current time, so raw Dates aren't comparable
  .refine(
    (data) => {
      if (!data.endDate) return true; // Skip if no endDate
      return startOfDay(data.endDate) >= startOfDay(data.startDate);
    },
    {
      message: "结束日期不能早于开始日期。",
      path: ["endDate"], // Target the error message to `endDate`
    }
  )
  // Check if the end date/time is earlier than the start date/time
  .refine(
    (data) => {
      if (!data.endDate || !data.endTime) return true; // Skip if no endDate or endTime

      // Combine date and time to compare
      const startDateTime = combineDateAndTime(data.startDate, data.startTime);
      const endDateTime = combineDateAndTime(data.endDate, data.endTime);

      return endDateTime > startDateTime; // Valid only if endDateTime is after startDateTime
    },
    {
      message: "结束时间必须晚于开始时间。",
      path: ["endTime"],
    }
  )
  .refine(
    (data) => {
      if (!data.endDate || !data.endTime) return true; // Skip if no endDate or endTime

      const startDateTime = combineDateAndTime(data.startDate, data.startTime);
      const endDateTime = combineDateAndTime(data.endDate, data.endTime);

      const durationInMinutes = differenceInMinutes(endDateTime, startDateTime);
      return durationInMinutes <= APP_CONSTANTS.ACTIVITY_MAX_DURATION_MINUTES; // Ensure duration is within max duration allowed
    },
    {
      message: `活动时长不能超过 ${
        APP_CONSTANTS.ACTIVITY_MAX_DURATION_MINUTES / 60
      } 小时`,
      path: ["endTime"],
    }
  )
  // Match the timer, which discards anything shorter than the minimum
  .refine(
    (data) => {
      if (!data.endDate || !data.endTime) return true; // Skip if no endDate or endTime

      const startDateTime = combineDateAndTime(data.startDate, data.startTime);
      const endDateTime = combineDateAndTime(data.endDate, data.endTime);

      const durationInMinutes = differenceInMinutes(endDateTime, startDateTime);
      return durationInMinutes >= APP_CONSTANTS.ACTIVITY_MIN_DURATION_MINUTES;
    },
    {
      message: `活动时长至少需要 ${APP_CONSTANTS.ACTIVITY_MIN_DURATION_MINUTES} 分钟`,
      path: ["endTime"],
    }
  )
  .refine(
    (data) => combineDateAndTime(data.startDate, data.startTime) <= new Date(),
    {
      message: "开始时间不能晚于当前时间。",
      path: ["startTime"],
    }
  );
