"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { TechnologyCount, TierCount } from "@/lib/dashboard";
import type { TechnologyGroup } from "@/lib/types";

const TIER_COLORS: Record<TierCount["tier"], string> = {
  served: "#0f6e62",
  underserved: "#c47b2b",
  unserved: "#8d5a54",
  none: "#7d8790",
};

const TECHNOLOGY_COLORS: Record<TechnologyGroup, string> = {
  fiber: "#0f6e62",
  cable: "#1f4e79",
  dsl: "#c47b2b",
  fixed_wireless: "#3d7ea6",
  satellite: "#6d4ca3",
  other: "#7d8790",
};

type ChartRow = {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
  fill: string;
};

function isChartRow(value: unknown): value is ChartRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ChartRow>;
  return typeof row.label === "string" && typeof row.count === "number";
}

function ChartTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!isChartRow(row)) return null;
  return (
    <div className="chart-tip">
      <strong>{row.label}</strong>
      <span>
        {row.count} provider{row.count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

type BarShapeProps = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  payload?: ChartRow;
};

function SpeedBarShape({ x = 0, y = 0, width = 0, height = 0, payload }: BarShapeProps) {
  const barX = Number(x);
  const barY = Number(y);
  const barWidth = Number(width);
  const barHeight = Number(height);
  if (barWidth <= 0 || barHeight <= 0) return <g />;
  const radius = Math.min(6, barWidth / 2, barHeight);
  const right = barX + barWidth;
  const bottom = barY + barHeight;
  const path = [
    `M${barX},${bottom}`,
    `H${right}`,
    `V${barY + radius}`,
    `Q${right},${barY} ${right - radius},${barY}`,
    `H${barX + radius}`,
    `Q${barX},${barY} ${barX},${barY + radius}`,
    "Z",
  ].join(" ");
  return <path d={path} fill={payload?.fill ?? "#0f6e62"} />;
}

function SpeedLabel(props: {
  x?: unknown;
  y?: unknown;
  width?: unknown;
  value?: unknown;
}) {
  const value = typeof props.value === "number" || typeof props.value === "string" ? Number(props.value) : NaN;
  const x = Number(props.x ?? 0) + Number(props.width ?? 0) / 2;
  const y = Number(props.y ?? 0) - 8;
  if (!Number.isFinite(value) || !Number.isFinite(x) || !Number.isFinite(y)) return <text />;
  return (
    <text x={x} y={y} textAnchor="middle" fill="#1a2421" fontSize={13} fontWeight={700}>
      {value}
    </text>
  );
}

export function ProviderCharts({
  tiers,
  technologies,
  providerCount,
}: {
  tiers: TierCount[];
  technologies: TechnologyCount[];
  providerCount: number;
}) {
  const tierRows: ChartRow[] = tiers.map((tier) => ({
    key: tier.tier,
    label: tier.label,
    shortLabel: tier.shortLabel,
    count: tier.count,
    fill: TIER_COLORS[tier.tier],
  }));
  const technologyRows: ChartRow[] = technologies.map((item) => ({
    key: item.group,
    label: item.label,
    shortLabel: item.label,
    count: item.count,
    fill: TECHNOLOGY_COLORS[item.group],
  }));

  return (
    <div className="charts">
      <figure className="card chart-card">
        <figcaption className="chart-title">
          <h3>Providers by speed tier</h3>
          <p>Each provider is counted once, at the fastest tier they filed.</p>
        </figcaption>
        <div className="chart-plot" role="img" aria-label="Bar chart of providers by speed tier">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tierRows} margin={{ top: 28, right: 12, left: 0, bottom: 8 }}>
              <XAxis
                dataKey="shortLabel"
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{ fill: "#5d6d68", fontSize: 12 }}
              />
              <YAxis
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                width={32}
                tick={{ fill: "#5d6d68", fontSize: 12 }}
              />
              <Tooltip
                content={ChartTooltip}
                cursor={{ fill: "rgba(14, 47, 44, 0.06)" }}
                wrapperStyle={{ outline: "none" }}
              />
              <Bar
                dataKey="count"
                maxBarSize={72}
                isAnimationActive
                animationDuration={400}
                shape={SpeedBarShape}
                label={SpeedLabel}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="sr-only">
          {tierRows.map((row) => (
            <li key={row.key}>
              {row.label}: {row.count} providers
            </li>
          ))}
        </ul>
      </figure>

      <figure className="card chart-card">
        <figcaption className="chart-title">
          <h3>Providers by technology</h3>
          <p>A provider is counted once for each technology they filed.</p>
        </figcaption>
        {technologyRows.length === 0 ? (
          <p className="empty-filter">No technology filings in this block.</p>
        ) : (
          <div className="donut-layout">
            <div className="donut-wrap" role="img" aria-label="Donut chart of providers by technology">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={technologyRows}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={technologyRows.length > 1 ? 2 : 0}
                    stroke="#fff"
                    strokeWidth={2}
                    isAnimationActive
                    animationBegin={0}
                    animationDuration={500}
                  >
                    {technologyRows.map((row) => (
                      <Cell key={row.key} fill={row.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={ChartTooltip} wrapperStyle={{ outline: "none" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <strong>{providerCount}</strong>
                <span>provider{providerCount === 1 ? "" : "s"}</span>
              </div>
            </div>
            <ul className="legend">
              {technologyRows.map((row) => (
                <li key={row.key}>
                  <span className="swatch" style={{ background: row.fill }} />
                  <span>{row.label}</span>
                  <span className="legend-count">{row.count}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </figure>
    </div>
  );
}
