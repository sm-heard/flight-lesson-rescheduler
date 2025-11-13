"use client";

import type { TrendPoint } from "@/lib/stats/trends";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { DateTime } from "luxon";

const chartConfig = {
  conflicts: {
    label: "Conflicts",
    theme: {
      light: "hsl(0 84% 60%)",
      dark: "hsl(0 80% 70%)",
    },
  },
  reschedules: {
    label: "Reschedules",
    theme: {
      light: "hsl(215 90% 57%)",
      dark: "hsl(217 82% 70%)",
    },
  },
} satisfies ChartConfig;

type Props = {
  data: TrendPoint[];
};

function formatTick(value: string) {
  return DateTime.fromISO(value).toFormat("MMM d");
}

export function TrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-6 text-center text-sm text-slate-500 shadow-sm">
        No trend data yet.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart data={data} barGap={6} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.5} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickFormatter={formatTick}
          minTickGap={16}
        />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} />
        <ChartTooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.25 }}
          content={<ChartTooltipContent indicator="dashed" hideLabel />}
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="conflicts"
          barSize={18}
          radius={[6, 6, 0, 0]}
          fill="var(--color-conflicts)"
        />
        <Bar
          dataKey="reschedules"
          barSize={18}
          radius={[6, 6, 0, 0]}
          fill="var(--color-reschedules)"
        />
      </BarChart>
    </ChartContainer>
  );
}
