"use client";

import { TECHNOLOGY_FILTERS, locationsAtTier, tierLabel } from "@/lib/technologies";
import {
  formatNumber,
  type SortDirection,
  type SortKey,
} from "@/lib/dashboard";
import type { ProviderFiling, TechnologyGroup } from "@/lib/types";

const SORT_OPTIONS: { value: string; key: SortKey; direction: SortDirection; label: string }[] = [
  { value: "tier:desc", key: "tier", direction: "desc", label: "Fastest tier first" },
  { value: "tier:asc", key: "tier", direction: "asc", label: "Slowest tier first" },
  { value: "provider:asc", key: "provider", direction: "asc", label: "Provider A–Z" },
  { value: "provider:desc", key: "provider", direction: "desc", label: "Provider Z–A" },
  { value: "technology:asc", key: "technology", direction: "asc", label: "Technology A–Z" },
  { value: "technology:desc", key: "technology", direction: "desc", label: "Technology Z–A" },
  { value: "locations:desc", key: "locations", direction: "desc", label: "Most locations" },
  { value: "locations:asc", key: "locations", direction: "asc", label: "Fewest locations" },
];

function locationLine(row: ProviderFiling): string {
  const atBest = locationsAtTier(
    row.bestTier,
    row.servedLocations,
    row.underservedLocations,
    row.unservedLocations,
  );
  const slower = row.locationsReported - atBest;
  const filed = `${formatNumber(row.locationsReported)} location${row.locationsReported === 1 ? "" : "s"} filed`;
  if (!row.bestTier) return filed;
  if (slower > 0) {
    return `${filed} · ${formatNumber(atBest)} at this tier, ${formatNumber(slower)} slower`;
  }
  return `${filed} · all at this tier`;
}

function ariaSort(active: boolean, direction: SortDirection): "ascending" | "descending" | "none" {
  if (!active) return "none";
  return direction === "asc" ? "ascending" : "descending";
}

function SortButton({
  label,
  column,
  sortKey,
  sortDirection,
  onSort,
  hint,
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onSort: (key: SortKey) => void;
  hint: string;
}) {
  const active = sortKey === column;
  return (
    <button type="button" onClick={() => onSort(column)}>
      {label}
      {active && <span className="sr-only">, {hint}</span>}
      {active && (
        <span aria-hidden="true" className="sort-mark">
          {sortDirection === "asc" ? "↑" : "↓"}
        </span>
      )}
    </button>
  );
}

export function ProviderTable({
  rows,
  filingCount,
  blockGeoid,
  group,
  counts,
  nameQuery,
  sortKey,
  sortDirection,
  onGroup,
  onName,
  onSort,
  onSortChange,
  onClear,
}: {
  rows: ProviderFiling[];
  filingCount: number;
  blockGeoid: string;
  group: TechnologyGroup | "all";
  counts: Map<TechnologyGroup, number>;
  nameQuery: string;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onGroup: (group: TechnologyGroup | "all") => void;
  onName: (value: string) => void;
  onSort: (key: SortKey) => void;
  onSortChange: (key: SortKey, direction: SortDirection) => void;
  onClear: () => void;
}) {
  const sortValue = `${sortKey}:${sortDirection}`;
  const filtered = group !== "all" || nameQuery.trim().length > 0;

  return (
    <section className="card table-card" aria-label="Carriers">
      <div className="toolbar">
        <div className="chips" role="toolbar" aria-label="Filter by technology">
          {TECHNOLOGY_FILTERS.filter(
            (filter) => filter.id === "all" || (counts.get(filter.id) ?? 0) > 0,
          ).map((filter) => {
            const count = filter.id === "all" ? filingCount : counts.get(filter.id) ?? 0;
            return (
              <button
                key={filter.id}
                type="button"
                className="chip"
                aria-pressed={group === filter.id}
                onClick={() => onGroup(filter.id)}
              >
                {filter.label}
                <span className="chip-count">{formatNumber(count)}</span>
              </button>
            );
          })}
        </div>
        <div className="filters">
          <label className="sort">
            Carrier
            <input
              className="name-filter"
              type="search"
              value={nameQuery}
              placeholder="Filter by name"
              aria-label="Filter carriers by name"
              onChange={(event) => onName(event.target.value)}
            />
          </label>
          <label className="sort mobile-sort">
            Sort
            <select
              value={sortValue}
              onChange={(event) => {
                const option = SORT_OPTIONS.find((item) => item.value === event.target.value);
                if (option) onSortChange(option.key, option.direction);
              }}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="meta" aria-live="polite">
        Showing {formatNumber(rows.length)} of {formatNumber(filingCount)} filing
        {filingCount === 1 ? "" : "s"}.
      </p>

      {rows.length === 0 ? (
        <div className="empty-filter">
          <p>No filings match this filter.</p>
          {filtered && (
            <button type="button" className="ghost" onClick={onClear}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Providers filing fixed broadband in census block {blockGeoid}
            </caption>
            <thead>
              <tr>
                <th scope="col" aria-sort={ariaSort(sortKey === "provider", sortDirection)}>
                  <SortButton
                    label="Provider"
                    column="provider"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    hint={sortDirection === "asc" ? "sorted A to Z" : "sorted Z to A"}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sortKey === "technology", sortDirection)}>
                  <SortButton
                    label="Technology"
                    column="technology"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    hint={sortDirection === "asc" ? "sorted A to Z" : "sorted Z to A"}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sortKey === "tier", sortDirection)}>
                  <SortButton
                    label="Speed tier"
                    column="tier"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    hint={sortDirection === "desc" ? "fastest first" : "slowest first"}
                  />
                </th>
                <th scope="col" aria-sort={ariaSort(sortKey === "locations", sortDirection)}>
                  <SortButton
                    label="Locations in the block"
                    column="locations"
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={onSort}
                    hint={sortDirection === "desc" ? "most locations first" : "fewest locations first"}
                  />
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.frn}-${row.technologyCode}-${row.providerName}`}>
                  <td data-label="Provider">
                    <span className="provider">{row.providerName}</span>
                    {row.frn && <span className="frn">FRN {row.frn}</span>}
                  </td>
                  <td data-label="Technology">
                    <span className={`tech tech-${row.technologyGroup}`}>{row.technologyDetail}</span>
                  </td>
                  <td data-label="Speed tier">
                    <span className={`badge ${row.bestTier ?? "none"}`}>{tierLabel(row.bestTier)}</span>
                  </td>
                  <td data-label="Locations in the block">{locationLine(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
