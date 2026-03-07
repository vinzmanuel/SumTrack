"use client";

import {
  Area,
  AreaChart as RechartsAreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import { formatTremorMoney, getTremorSeriesColor } from "@/lib/tremor-raw";

type ChartDatum = Record<string, string | number | undefined>;

export function TremorAreaChart({
  className,
  data,
  index,
  categories,
  showLegend = true,
}: {
  className?: string;
  data: ChartDatum[];
  index: string;
  categories: string[];
  showLegend?: boolean;
}) {
  return (
    <div className={cn("h-64 w-full", className)}>
      <ResponsiveContainer height="100%" width="100%">
        <RechartsAreaChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey={index} tick={{ fontSize: 12 }} tickLine={false} />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} width={72} />
          <Tooltip
            formatter={(value, name) => [formatTremorMoney(Number(value ?? 0)), String(name ?? "")]}
            labelClassName="text-xs"
          />
          {showLegend ? <Legend /> : null}
          {categories.map((key, idx) => (
            <Area
              dataKey={key}
              fill={getTremorSeriesColor(idx)}
              fillOpacity={0.15}
              key={key}
              stroke={getTremorSeriesColor(idx)}
              strokeWidth={2}
              type="monotone"
            />
          ))}
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
