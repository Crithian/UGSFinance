import { TECHNOLOGY_FILTERS, tierLabel, tierRank } from "./technologies";
import type { ProviderFiling, SpeedTier, TechnologyGroup } from "./types";

export type SortKey = "tier" | "provider" | "technology" | "locations";
export type SortDirection = "asc" | "desc";

export type TierCount = {
  tier: SpeedTier | "none";
  /** Full FCC tier description for tooltips and screen readers. */
  label: string;
  /** Short axis label. */
  shortLabel: string;
  count: number;
};

export type TechnologyCount = {
  group: TechnologyGroup;
  label: string;
  count: number;
};

/** Fastest speed the block summary can support. Exact Mbps is not in this dataset. */
export type FastestAdvertised = {
  readout: string;
  unit: string;
  detail: string;
};

export type DashboardSummary = {
  providerCount: number;
  filingCount: number;
  servedProviderCount: number;
  fiberProviderCount: number;
  fastest: FastestAdvertised;
  tiers: TierCount[];
  technologies: TechnologyCount[];
};

const TIER_SHORT: Record<SpeedTier | "none", string> = {
  served: "≥ 100/20",
  underserved: "25/3–100/20",
  unserved: "< 25/3",
  none: "Not reported",
};

const EXACT_MBPS =
  "The block summary publishes FCC tiers, not an exact Mbps figure.";

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function providerKey(name: string): string {
  return name.trim().toLowerCase();
}

function bestTierByProvider(rows: ProviderFiling[]): Map<string, SpeedTier | null> {
  const best = new Map<string, SpeedTier | null>();
  for (const row of rows) {
    const key = providerKey(row.providerName);
    const current = best.get(key);
    if (current === undefined || tierRank(row.bestTier) < tierRank(current)) {
      best.set(key, row.bestTier);
    }
  }
  return best;
}

function fastestAdvertised(best: Map<string, SpeedTier | null>): FastestAdvertised {
  const tiers = [...best.values()];
  if (tiers.length === 0) {
    return {
      readout: "—",
      unit: "No filings",
      detail: "This block has no fixed-broadband filing to measure.",
    };
  }
  if (tiers.includes("served")) {
    return {
      readout: "≥ 100 / 20",
      unit: "Mbps down / up",
      detail: `Fastest tier filed in this block. ${EXACT_MBPS}`,
    };
  }
  if (tiers.includes("underserved")) {
    return {
      readout: "≥ 25 / 3",
      unit: "Mbps, below 100/20",
      detail: `No filing reaches 100/20. ${EXACT_MBPS}`,
    };
  }
  if (tiers.includes("unserved")) {
    return {
      readout: "< 25 / 3",
      unit: "Mbps down / up",
      detail: `No filing reaches 25/3. ${EXACT_MBPS}`,
    };
  }
  return {
    readout: "—",
    unit: "Not reported",
    detail: EXACT_MBPS,
  };
}

export function summarize(rows: ProviderFiling[]): DashboardSummary {
  const best = bestTierByProvider(rows);
  const tierTotals: Record<SpeedTier | "none", number> = {
    served: 0,
    underserved: 0,
    unserved: 0,
    none: 0,
  };
  for (const tier of best.values()) tierTotals[tier ?? "none"] += 1;

  const tiers: TierCount[] = (["served", "underserved", "unserved"] as const).map((tier) => ({
    tier,
    label: tierLabel(tier),
    shortLabel: TIER_SHORT[tier],
    count: tierTotals[tier],
  }));
  if (tierTotals.none > 0) {
    tiers.push({
      tier: "none",
      label: tierLabel(null),
      shortLabel: TIER_SHORT.none,
      count: tierTotals.none,
    });
  }

  const namesByGroup = new Map<TechnologyGroup, Set<string>>();
  for (const row of rows) {
    const names = namesByGroup.get(row.technologyGroup) ?? new Set<string>();
    names.add(providerKey(row.providerName));
    namesByGroup.set(row.technologyGroup, names);
  }

  const technologies: TechnologyCount[] = [];
  for (const filter of TECHNOLOGY_FILTERS) {
    if (filter.id === "all") continue;
    const count = namesByGroup.get(filter.id)?.size ?? 0;
    if (count > 0) technologies.push({ group: filter.id, label: filter.label, count });
  }

  const fiberProviderCount = namesByGroup.get("fiber")?.size ?? 0;

  return {
    providerCount: best.size,
    filingCount: rows.length,
    servedProviderCount: tierTotals.served,
    fiberProviderCount,
    fastest: fastestAdvertised(best),
    tiers,
    technologies,
  };
}

export function filingCounts(rows: ProviderFiling[]): Map<TechnologyGroup, number> {
  const counts = new Map<TechnologyGroup, number>();
  for (const row of rows) {
    counts.set(row.technologyGroup, (counts.get(row.technologyGroup) ?? 0) + 1);
  }
  return counts;
}

function compare(
  a: ProviderFiling,
  b: ProviderFiling,
  key: SortKey,
  direction: SortDirection,
): number {
  const sign = direction === "asc" ? 1 : -1;
  let primary = 0;
  if (key === "provider") primary = a.providerName.localeCompare(b.providerName);
  else if (key === "technology") primary = a.technologyDetail.localeCompare(b.technologyDetail);
  else if (key === "locations") primary = a.locationsReported - b.locationsReported;
  else primary = tierRank(b.bestTier) - tierRank(a.bestTier);
  if (primary !== 0) return primary * sign;
  const name = a.providerName.localeCompare(b.providerName);
  if (name !== 0) return name;
  return a.technologyDetail.localeCompare(b.technologyDetail);
}

export function visibleFilings(
  rows: ProviderFiling[],
  group: TechnologyGroup | "all",
  nameQuery: string,
  sortKey: SortKey,
  sortDirection: SortDirection,
): ProviderFiling[] {
  const needle = nameQuery.trim().toLowerCase();
  return rows
    .filter((row) => group === "all" || row.technologyGroup === group)
    .filter((row) => !needle || row.providerName.toLowerCase().includes(needle))
    .sort((a, b) => compare(a, b, sortKey, sortDirection));
}
