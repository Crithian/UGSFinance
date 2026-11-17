"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProviderTable } from "@/components/ProviderTable";
import { SearchBar } from "@/components/SearchBar";
import { ResultHeader, SummaryCards } from "@/components/Summary";
import {
  filingCounts,
  summarize,
  visibleFilings,
  type SortDirection,
  type SortKey,
} from "@/lib/dashboard";
import type {
  AddressMatch,
  LookupErrorBody,
  LookupResponse,
  LookupSuccess,
  TechnologyGroup,
} from "@/lib/types";

const ProviderCharts = dynamic(
  () => import("@/components/ProviderCharts").then((mod) => mod.ProviderCharts),
  {
    ssr: false,
    loading: () => (
      <div className="charts" aria-hidden="true">
        <div className="skeleton skeleton-chart" />
        <div className="skeleton skeleton-chart" />
      </div>
    ),
  },
);

function LoadingState() {
  return (
    <>
      <p className="status" role="status">
        Matching the address with the Census Bureau, then reading FCC filings for that block.
      </p>
      <div className="skeleton-stack" aria-hidden="true">
        <div className="skeleton skeleton-head" />
        <div className="stats">
          <div className="skeleton skeleton-stat" />
          <div className="skeleton skeleton-stat" />
          <div className="skeleton skeleton-stat" />
          <div className="skeleton skeleton-stat" />
        </div>
        <div className="charts">
          <div className="skeleton skeleton-chart" />
          <div className="skeleton skeleton-chart" />
        </div>
      </div>
    </>
  );
}

function EmptyState() {
  return (
    <section className="card empty">
      <h2>Look up fixed broadband for a service address</h2>
      <p>
        Enter a U.S. street address. This dashboard lists every provider that filed
        fixed broadband in the 2020 census block for that address, with technology
        and the advertised speed tier.
      </p>
      <ul className="empty-points">
        <li>
          <strong>Address</strong>
          The Census geocoder matches the street address to a census block.
        </li>
        <li>
          <strong>Providers</strong>
          Fiber, cable, DSL, fixed wireless, and satellite filings for that block.
        </li>
        <li>
          <strong>Speeds</strong>
          Advertised service is an FCC tier. The block summary does not include an exact Mbps figure.
        </li>
      </ul>
      <p className="callout">
        Results are for the census block that contains the address, not a promise
        that a provider serves the specific building.
      </p>
    </section>
  );
}

function MatchPicker({
  matches,
  truncated,
  onPick,
}: {
  matches: AddressMatch[];
  truncated: boolean;
  onPick: (address: string, blockGeoid: string) => void;
}) {
  return (
    <section className="card picker" aria-label="Choose an address">
      <h2>Several addresses matched</h2>
      <p className="meta">
        Choose the location you want to check.
        {truncated ? " Add a city and ZIP if yours is not listed." : ""}
      </p>
      <ul className="match-list">
        {matches.map((match) => (
          <li key={match.blockGeoid}>
            <button type="button" onClick={() => onPick(match.matchedAddress, match.blockGeoid)}>
              <strong>{match.matchedAddress}</strong>
              <span className="sub">
                {[match.county, match.stateAbbr].filter(Boolean).join(", ") || "U.S."}
                {" · "}block {match.blockGeoid}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function LookupApp() {
  const [address, setAddress] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<AddressMatch[] | null>(null);
  const [matchesTruncated, setMatchesTruncated] = useState(false);
  const [result, setResult] = useState<LookupSuccess | null>(null);
  const [group, setGroup] = useState<TechnologyGroup | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [nameQuery, setNameQuery] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const query = address.trim();
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(() => {
      const current = ++requestRef.current;
      fetch(`/api/suggest?q=${encodeURIComponent(query)}`)
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((payload: { suggestions?: string[] }) => {
          if (current !== requestRef.current) return;
          setSuggestions(payload.suggestions ?? []);
        })
        .catch(() => {
          if (current === requestRef.current) setSuggestions([]);
        });
    }, 220);
    return () => window.clearTimeout(handle);
  }, [address]);

  async function runLookup(nextAddress: string, block?: string) {
    const trimmed = nextAddress.trim();
    setAddress(trimmed);
    setOpen(false);
    setSuggestions([]);
    setError(null);
    setMatches(null);
    setMatchesTruncated(false);
    setLoading(true);
    setGroup("all");
    setNameQuery("");
    setSortKey("tier");
    setSortDirection("desc");
    try {
      const params = new URLSearchParams({ address: trimmed });
      if (block) params.set("block", block);
      const response = await fetch(`/api/lookup?${params.toString()}`);
      const payload = (await response.json()) as LookupResponse | LookupErrorBody;
      if (!response.ok || "error" in payload) {
        const message = "error" in payload ? payload.error : "That address could not be looked up.";
        setResult(null);
        setError(message);
        return;
      }
      if (payload.status === "ambiguous") {
        setResult(null);
        setMatches(payload.matches);
        setMatchesTruncated(payload.truncated);
        return;
      }
      setResult(payload);
    } catch {
      setResult(null);
      setError("The lookup could not reach the server. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection(key === "provider" || key === "technology" ? "asc" : "desc");
  }

  const summary = useMemo(() => (result ? summarize(result.providers) : null), [result]);
  const counts = useMemo(() => filingCounts(result?.providers ?? []), [result]);
  const rows = useMemo(
    () =>
      result
        ? visibleFilings(result.providers, group, nameQuery, sortKey, sortDirection)
        : [],
    [result, group, nameQuery, sortKey, sortDirection],
  );

  return (
    <div className="shell">
      <a className="skip" href="#address">
        Skip to address search
      </a>
      <header className="topbar">
        <div className="wrap topbar-inner">
          <div className="brand">
            <span className="mark" aria-hidden="true">
              UGS
            </span>
            <div>
              <p className="org">Unified Global Solutions</p>
              <h1>Carrier Lookup</h1>
            </div>
          </div>
          <p className="top-note">Staff · Fixed broadband</p>
        </div>
      </header>

      <main className="wrap page" aria-busy={loading}>
        <SearchBar
          address={address}
          loading={loading}
          suggestions={suggestions}
          open={open}
          active={active}
          onAddressChange={setAddress}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          onActiveChange={setActive}
          onSearch={(value) => void runLookup(value)}
        />

        <div className="results" id="results">
          {loading && <LoadingState />}

          {!loading && error && (
            <div className="banner" role="alert">
              <strong>Lookup failed</strong>
              <p>{error}</p>
            </div>
          )}

          {!loading && matches && (
            <MatchPicker
              matches={matches}
              truncated={matchesTruncated}
              onPick={(matchedAddress, blockGeoid) => void runLookup(matchedAddress, blockGeoid)}
            />
          )}

          {!loading && result && summary && (
            <div className="dashboard" aria-live="polite">
              <ResultHeader result={result} />
              <SummaryCards summary={summary} />
              {result.providers.length === 0 ? (
                <p className="empty-block">
                  The Census matched this address, and the {result.vintage.asOf} FCC summary
                  has no fixed-broadband filings for block {result.censusBlock.geoid}.
                </p>
              ) : (
                <>
                  <ProviderCharts
                    tiers={summary.tiers}
                    technologies={summary.technologies}
                    providerCount={summary.providerCount}
                  />
                  <ProviderTable
                    rows={rows}
                    filingCount={summary.filingCount}
                    blockGeoid={result.censusBlock.geoid}
                    group={group}
                    counts={counts}
                    nameQuery={nameQuery}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onGroup={setGroup}
                    onName={setNameQuery}
                    onSort={toggleSort}
                    onSortChange={(key, direction) => {
                      setSortKey(key);
                      setSortDirection(direction);
                    }}
                    onClear={() => {
                      setGroup("all");
                      setNameQuery("");
                    }}
                  />
                </>
              )}
            </div>
          )}

          {!loading && !error && !matches && !result && <EmptyState />}
        </div>

        <details className="card about">
          <summary>About this data</summary>
          <p>
            Address matching uses the U.S. Census Bureau geocoder. Provider filings
            come from the FCC Broadband Data Collection,{" "}
            {result?.vintage.label ?? "December 2025 vintage"}, as republished for
            live query by Esri in the Living Atlas. The official BDC public API
            serves bulk download files and requires a free FCC username and hash
            token. It does not accept a street address. Building points and
            addresses belong to the licensed Broadband Serviceable Location Fabric,
            so this page reports the census block, which is the finest public
            geography available for a live lookup.
          </p>
          <p>
            Speed tiers follow the FCC summary: <strong>≥ 100/20 Mbps</strong>{" "}
            (served), <strong>at least 25/3 Mbps and below 100/20 Mbps</strong>{" "}
            (underserved), and <strong>below 25/3 Mbps</strong>. The block summary
            does not include the exact Mbps integer from the location-level filing.
            Counts are broadband-serviceable locations in the block where that
            provider filed that technology.
          </p>
          <ul>
            <li>
              <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noreferrer">
                FCC National Broadband Map
              </a>
            </li>
            <li>
              <a
                href="https://www.arcgis.com/home/item.html?id=e1343efcefc344709057260ee57290a0"
                target="_blank"
                rel="noreferrer"
              >
                Esri layer: FCC Broadband Data Collection
              </a>
            </li>
            <li>
              <a href="https://geocoding.geo.census.gov/geocoder/" target="_blank" rel="noreferrer">
                Census geocoder
              </a>
            </li>
          </ul>
        </details>
        <p className="foot">
          Unified Global Solutions staff tool. Queried live for each address. No
          provider list is stored in this app. Results describe the census block,
          not the individual building.
          {result ? ` Last response ${new Date(result.queriedAt).toLocaleString()}.` : ""}
        </p>
      </main>
    </div>
  );
}
