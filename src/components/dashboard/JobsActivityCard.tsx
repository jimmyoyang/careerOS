"use client";
import { zhLabel } from "@/lib/i18n/zh-CN";

import { RefObject, useMemo, useRef } from "react";
import { Pie, PieSvgProps } from "@nivo/pie";
import { animated } from "@react-spring/web";
import { useTheme } from "next-themes";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  JobsActivitySummary,
  TopActivityType,
} from "@/actions/dashboard.actions";
import { useElementWidth } from "@/hooks/useElementWidth";
import { usePersistedTabIndex } from "@/hooks/usePersistedTabIndex";
import { APP_CONSTANTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ARC_LABEL_TEXT_COLOR,
  arcLabelLines,
  buildDonutSlices,
  CHART_HEIGHT,
  donutLayout,
  DonutSlice,
} from "./jobsActivityChart";

interface JobsActivityCardProps {
  data: {
    label: string;
    summary: JobsActivitySummary;
  }[];
}

type ArcLinkLabelProps = Parameters<
  NonNullable<PieSvgProps<DonutSlice>["arcLinkLabelComponent"]>
>[0];

// Hole the total needs before the hours, jobs and trend lines all clear the
// ring; under it the trend goes and the other two step down a size.
const FULL_TOTAL_HOLE = 96;

// nivo renders an arc link label as one <text>, so stacking the hours under
// the name needs a custom component rather than a label formatter.
// The budget arrives by ref because a new component type would remount the
// whole label subtree on every frame the card resizes.
function makeArcLinkLabel(maxChars: RefObject<number>) {
  return function ArcLinkLabel({ datum, style }: ArcLinkLabelProps) {
    const [name, hours] = arcLabelLines(datum.data, maxChars.current);

    return (
      <animated.g opacity={style.opacity}>
        <animated.path
          fill="none"
          stroke={style.linkColor}
          strokeWidth={style.thickness}
          d={style.path}
        />
        <animated.text
          transform={style.textPosition}
          textAnchor={style.textAnchor}
          dominantBaseline="central"
          fill={style.textColor}
          fontSize={11}
        >
          <tspan x={0} dy="-0.5em">
            {name}
          </tspan>
          <tspan x={0} dy="1.15em" fontWeight={600}>
            {hours}
          </tspan>
        </animated.text>
      </animated.g>
    );
  };
}

export default function JobsActivityCard({ data }: JobsActivityCardProps) {
  const [activeIndex, selectTab] = usePersistedTabIndex(
    APP_CONSTANTS.DASHBOARD_JOBS_ACTIVITY_STORAGE_KEY,
    data.map((item) => item.label),
  );
  const [chartRef, chartWidth] = useElementWidth<HTMLDivElement>();
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "light" ? "light" : "dark";
  const current = data[activeIndex];
  const {
    jobsApplied,
    jobsTrend,
    topActivities,
    otherActivities,
    otherHours,
    totalHours,
  } = current.summary;
  const slices = buildDonutSlices(
    topActivities,
    otherHours,
    theme,
    otherActivities,
  );
  const layout = donutLayout(chartWidth);
  const roomyTotal = layout.holeDiameter >= FULL_TOTAL_HOLE;
  const maxLabelChars = useRef(layout.maxLabelChars);
  maxLabelChars.current = layout.maxLabelChars;
  const arcLinkLabelComponent = useMemo(
    () => makeArcLinkLabel(maxLabelChars),
    [],
  );

  return (
    <Card className="@lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg text-green-600 min-w-0 truncate">
            职位与活动
          </CardTitle>
          <div
            className="flex shrink-0 rounded-md border text-xs"
            data-testid="jobs-activity-toggle-group"
          >
            {data.map((item, index) => (
              <button
                key={zhLabel(item.label)}
                onClick={() => selectTab(index)}
                className={cn(
                  "px-2 py-1 transition-colors",
                  index === 0 && "rounded-l-md",
                  index === data.length - 1 && "rounded-r-md",
                  activeIndex === index
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {zhLabel(item.label)}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div ref={chartRef} className="relative h-[200px] w-full">
          {slices.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="h-[132px] w-[132px] rounded-full border-[18px] border-muted" />
              <p className="absolute inset-x-0 bottom-0 text-center text-sm text-muted-foreground">
                暂无活动记录
              </p>
            </div>
          ) : (
            chartWidth > 0 && (
              <Pie
                data={slices}
                // Sized from the card's own measurement rather than a second
                // one of nivo's: two observers on this box update a frame
                // apart, and the frame where the new gutters met the old
                // width collapsed the donut to half its radius.
                width={chartWidth}
                height={CHART_HEIGHT}
                // Width changes land on every frame of the panel's 200ms
                // transition, so the donut tracks them instead of springing
                // toward each one in turn.
                animate={false}
                margin={{
                  top: 26,
                  right: layout.gutter,
                  bottom: 26,
                  left: layout.gutter,
                }}
                innerRadius={0.72}
                padAngle={2}
                cornerRadius={2}
                activeOuterRadiusOffset={4}
                colors={{ datum: "data.color" }}
                borderWidth={0}
                enableArcLabels={false}
                enableArcLinkLabels
                arcLinkLabelComponent={arcLinkLabelComponent}
                arcLinkLabelsThickness={2}
                arcLinkLabelsDiagonalLength={10}
                arcLinkLabelsStraightLength={12}
                arcLinkLabelsTextOffset={4}
                arcLinkLabelsColor={{ from: "data.color" }}
                arcLinkLabelsTextColor={ARC_LABEL_TEXT_COLOR[theme]}
                theme={{
                  text: { fontSize: 11 },
                  tooltip: {
                    container: { background: "#1e293b", color: "#fff" },
                  },
                }}
                tooltip={({ datum }) => (
                  <div
                    style={{
                      background: "#1e293b",
                      color: "#fff",
                      padding: "6px 12px",
                      borderRadius: "4px",
                      fontSize: "12px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <strong>{zhLabel(String(datum.data.label))}</strong> — {datum.value}小时
                    {datum.data.breakdown?.map((activity: TopActivityType) => (
                      <div key={activity.label}>
                        {zhLabel(activity.label)} — {activity.hours}小时
                      </div>
                    ))}
                  </div>
                )}
              />
            )
          )}
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-px text-center"
            data-testid="jobs-activity-total"
          >
            <span
              className={cn(
                "font-bold leading-tight tabular-nums",
                roomyTotal ? "text-xl" : "text-base",
              )}
            >
              {totalHours}小时
            </span>
            <span
              className={cn(
                "text-muted-foreground tabular-nums",
                roomyTotal ? "text-sm" : "text-xs",
              )}
            >
              {jobsApplied} 个职位
            </span>
            {jobsTrend !== 0 && roomyTotal && (
              <span
                className={cn(
                  "flex items-center gap-0.5 text-[10px] tabular-nums",
                  jobsTrend > 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {jobsTrend > 0 ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {Math.abs(jobsTrend)}%
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
