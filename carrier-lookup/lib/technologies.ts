import type { SpeedTier, TechnologyGroup } from "./types";

export type TechnologyInfo = {
  code: number;
  /** Short label used for grouping and filters. */
  technology: string;
  /** FCC technology name shown on each row. */
  technologyDetail: string;
  group: TechnologyGroup;
};

const TECHNOLOGIES: Record<number, TechnologyInfo> = {
  0: {
    code: 0,
    technology: "Other",
    technologyDetail: "Other",
    group: "other",
  },
  10: {
    code: 10,
    technology: "DSL",
    technologyDetail: "DSL (copper)",
    group: "dsl",
  },
  40: {
    code: 40,
    technology: "Cable",
    technologyDetail: "Cable",
    group: "cable",
  },
  50: {
    code: 50,
    technology: "Fiber",
    technologyDetail: "Fiber",
    group: "fiber",
  },
  60: {
    code: 60,
    technology: "Satellite",
    technologyDetail: "Satellite (geostationary)",
    group: "satellite",
  },
  61: {
    code: 61,
    technology: "Satellite",
    technologyDetail: "Satellite (non-geostationary)",
    group: "satellite",
  },
  70: {
    code: 70,
    technology: "Fixed wireless",
    technologyDetail: "Fixed wireless (unlicensed)",
    group: "fixed_wireless",
  },
  71: {
    code: 71,
    technology: "Fixed wireless",
    technologyDetail: "Fixed wireless (licensed)",
    group: "fixed_wireless",
  },
  72: {
    code: 72,
    technology: "Fixed wireless",
    technologyDetail: "Fixed wireless (licensed-by-rule)",
    group: "fixed_wireless",
  },
};

export const TECHNOLOGY_FILTERS: { id: TechnologyGroup | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "fiber", label: "Fiber" },
  { id: "cable", label: "Cable" },
  { id: "dsl", label: "DSL" },
  { id: "fixed_wireless", label: "Fixed wireless" },
  { id: "satellite", label: "Satellite" },
  { id: "other", label: "Other" },
];

export function technologyInfo(code: number): TechnologyInfo {
  return (
    TECHNOLOGIES[code] ?? {
      code,
      technology: "Other",
      technologyDetail: `Other (code ${code})`,
      group: "other",
    }
  );
}

export function bestTier(
  served: number,
  underserved: number,
  unserved: number,
): SpeedTier | null {
  if (served > 0) return "served";
  if (underserved > 0) return "underserved";
  if (unserved > 0) return "unserved";
  return null;
}

/** FCC/Esri speed tier for the max advertised speed in the block. */
export function tierLabel(tier: SpeedTier | null): string {
  switch (tier) {
    case "served":
      return "≥ 100 Mbps down / 20 Mbps up";
    case "underserved":
      return "At least 25/3 Mbps, below 100/20 Mbps";
    case "unserved":
      return "Below 25/3 Mbps";
    default:
      return "Speed tier not reported";
  }
}

export function tierRank(tier: SpeedTier | null): number {
  switch (tier) {
    case "served":
      return 0;
    case "underserved":
      return 1;
    case "unserved":
      return 2;
    default:
      return 3;
  }
}

export function locationsAtTier(
  tier: SpeedTier | null,
  served: number,
  underserved: number,
  unserved: number,
): number {
  switch (tier) {
    case "served":
      return served;
    case "underserved":
      return underserved;
    case "unserved":
      return unserved;
    default:
      return 0;
  }
}
