"use client";

import { FormEvent, KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  TECHNOLOGY_FILTERS,
  locationsAtTier,
  tierLabel,
  tierRank,
} from "@/lib/technologies";
import type {
  AddressMatch,
  LookupErrorBody,
  LookupResponse,
  LookupSuccess,
  ProviderFiling,
  TechnologyGroup,
} from "@/lib/types";

const EXAMPLES = [
  "350 Fifth Avenue, New York, NY 10118",
  "1600 Pennsylvania Avenue NW, Washington, DC 20500",
];

type SortKey = "tier" | "provider" | "technology";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

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

function placeLine(result: LookupSuccess): string {
  const parts = [
    result.censusBlock.place,
    result.censusBlock.county,
    result.censusBlock.stateAbbr ?? result.censusBlock.state,
  ].filter(Boolean);
  return parts.join(", ");
}

export function LookupApp() {
  const listId = useId();
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
  const [nameQuery, setNameQuery] = useState("");
  const requestRef = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

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
    try {
      const params = new URLSearchParams({ address: trimmed });
      if (block) params.set("block", block);
      const response = await fetch(`/api/lookup?${params.toString()}`);
      const payload = (await response.json()) as LookupResponse | LookupErrorBody;
      if (!response.ok || "error" in payload) {
        const message =
          "error" in payload
            ? payload.error
            : "That address could not be looked up.";
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

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const chosen = active >= 0 ? suggestions[active] : address;
    void runLookup(chosen);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!open || suggestions.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  const rows = useMemo(() => {
    if (!result) return [];
    const needle = nameQuery.trim().toLowerCase();
    return result.providers
      .filter((row) => group === "all" || row.technologyGroup === group)
      .filter((row) => !needle || row.providerName.toLowerCase().includes(needle))
      .sort((a, b) => {
        if (sortKey === "provider") {
          return a.providerName.localeCompare(b.providerName) || a.technologyDetail.localeCompare(b.technologyDetail);
        }
        if (sortKey === "technology") {
          return a.technologyDetail.localeCompare(b.technologyDetail) || a.providerName.localeCompare(b.providerName);
        }
        return (
          tierRank(a.bestTier) - tierRank(b.bestTier) ||
          b.servedLocations - a.servedLocations ||
          a.providerName.localeCompare(b.providerName)
        );
      });
  }, [result, group, sortKey, nameQuery]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of result?.providers ?? []) {
      map.set(row.technologyGroup, (map.get(row.technologyGroup) ?? 0) + 1);
    }
    return map;
  }, [result]);

  const providerCount = new Set(
    (result?.providers ?? []).map((row) => row.providerName.toLowerCase()),
  ).size;

  return (
    <>
      <header className="band">
        <div className="wrap">
          <p className="kicker">Staff tool · Fixed broadband</p>
          <h1>Carrier Lookup</h1>
          <p className="lede">
            Type a U.S. street address to see the providers that filed fixed
            broadband service for its census block, with technology and the
            advertised speed tier.
          </p>
        </div>
      </header>

      <main className="stage">
        <div className="wrap">
          <section className="card search-card" aria-label="Address search">
            <form className="search-form" onSubmit={onSubmit} role="search">
              <div className="combo">
                <label className="address-label" htmlFor="address">
                  Street address
                </label>
                <input
                  ref={inputRef}
                  id="address"
                  type="search"
                  name="address"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="350 Fifth Avenue, New York, NY 10118"
                  value={address}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={open && suggestions.length > 0}
                  aria-controls={listId}
                  aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setOpen(true);
                    setActive(-1);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={onKeyDown}
                />
                {open && suggestions.length > 0 && (
                  <ul className="suggestions" id={listId} role="listbox">
                    {suggestions.map((suggestion, index) => (
                      <li key={suggestion} role="presentation">
                        <button
                          type="button"
                          role="option"
                          id={`${listId}-${index}`}
                          aria-selected={index === active}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void runLookup(suggestion)}
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button className="primary" type="submit" disabled={loading}>
                {loading ? "Looking up…" : "Look up"}
              </button>
            </form>
            <div className="examples">
              <span>Try</span>
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="ghost"
                  onClick={() => void runLookup(example)}
                >
                  {example}
                </button>
              ))}
            </div>
          </section>

          {loading && (
            <p className="status" role="status">
              Matching the address with the Census Bureau, then reading FCC
              filings for that block.
            </p>
          )}

          {error && (
            <p className="status error" role="alert">
              {error}
            </p>
          )}

          {matches && (
            <section className="status" aria-label="Choose an address">
              <strong>Several addresses matched.</strong>
              <p className="meta">
                Choose the location you want to check.
                {matchesTruncated ? " Add a city and ZIP if yours is not listed." : ""}
              </p>
              <ul className="match-list">
                {matches.map((match) => (
                  <li key={match.blockGeoid}>
                    <button
                      type="button"
                      onClick={() => void runLookup(match.matchedAddress, match.blockGeoid)}
                    >
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
          )}

          {result && (
            <section className="card result" aria-live="polite">
              <p className="address-label">Census matched address</p>
              <h2 className="address">{result.matchedAddress}</h2>
              <dl className="facts">
                <div>
                  <dt>Block</dt>
                  <dd>{result.censusBlock.geoid}</dd>
                </div>
                {placeLine(result) && (
                  <div>
                    <dt>Place</dt>
                    <dd>{placeLine(result)}</dd>
                  </div>
                )}
                <div>
                  <dt>Coordinates</dt>
                  <dd>
                    {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                  </dd>
                </div>
                {result.censusBlock.totalLocations !== null && (
                  <div>
                    <dt>Serviceable locations</dt>
                    <dd>{formatNumber(result.censusBlock.totalLocations)} in this block</dd>
                  </div>
                )}
                <div>
                  <dt>Vintage</dt>
                  <dd>{result.vintage.asOf}</dd>
                </div>
              </dl>

              <p className="callout">
                These filings cover the 2020 census block that contains the
                matched address. A provider on this list filed service at one
                or more broadband-serviceable locations in the block. Confirm
                the building on the{" "}
                <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noreferrer">
                  National Broadband Map
                </a>{" "}
                when the specific address decides an order. Advertised speeds
                are the FCC tiers published for the block, {result.vintage.asOf}.
              </p>

              {result.providers.length === 0 ? (
                <p className="empty-block">
                  The Census matched this address, and the {result.vintage.asOf}{" "}
                  FCC summary has no fixed-broadband filings for block{" "}
                  {result.censusBlock.geoid}.
                </p>
              ) : (
                <>
                  <div className="toolbar">
                    <div>
                      <div className="chips" role="toolbar" aria-label="Filter by technology">
                        {TECHNOLOGY_FILTERS.filter(
                          (filter) =>
                            filter.id === "all" || (counts.get(filter.id) ?? 0) > 0,
                        ).map((filter) => {
                          const count =
                            filter.id === "all"
                              ? result.providers.length
                              : counts.get(filter.id) ?? 0;
                          return (
                            <button
                              key={filter.id}
                              type="button"
                              className="chip"
                              aria-pressed={group === filter.id}
                              onClick={() => setGroup(filter.id)}
                            >
                              {filter.label} {count}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <label className="sort">
                      Provider
                      <input
                        className="name-filter"
                        type="search"
                        value={nameQuery}
                        placeholder="Filter by name"
                        onChange={(event) => setNameQuery(event.target.value)}
                      />
                    </label>
                    <label className="sort">
                      Sort
                      <select
                        value={sortKey}
                        onChange={(event) => setSortKey(event.target.value as SortKey)}
                      >
                        <option value="tier">Best speed tier</option>
                        <option value="provider">Provider name</option>
                        <option value="technology">Technology</option>
                      </select>
                    </label>
                  </div>

                  <p className="meta">
                    {formatNumber(providerCount)} provider{providerCount === 1 ? "" : "s"},{" "}
                    {formatNumber(result.providers.length)} technology filing
                    {result.providers.length === 1 ? "" : "s"}. Showing {formatNumber(rows.length)}.
                  </p>

                  {rows.length === 0 ? (
                    <p className="empty-filter">No filings match this filter.</p>
                  ) : (
                    <div className="table-wrap">
                      <table>
                        <caption className="sr-only">
                          Providers filing fixed broadband in census block {result.censusBlock.geoid}
                        </caption>
                        <thead>
                          <tr>
                            <th scope="col">Provider</th>
                            <th scope="col">Technology</th>
                            <th scope="col">Max advertised speed</th>
                            <th scope="col">Locations in the block</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={`${row.frn}-${row.technologyCode}-${row.providerName}`}>
                              <td data-label="Provider">
                                <span className="provider">{row.providerName}</span>
                                {row.frn && <span className="frn">FRN {row.frn}</span>}
                              </td>
                              <td data-label="Technology">{row.technologyDetail}</td>
                              <td data-label="Max advertised speed">
                                <span className={`badge ${row.bestTier ?? "none"}`}>
                                  {tierLabel(row.bestTier)}
                                </span>
                              </td>
                              <td data-label="Locations in the block">{locationLine(row)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          <details className="card about">
            <summary>About this data</summary>
            <p>
              Address matching uses the U.S. Census Bureau geocoder. Provider
              filings come from the FCC Broadband Data Collection,{" "}
              {result?.vintage.label ?? "December 2025 vintage"}, as republished
              for live query by Esri in the Living Atlas. The official BDC
              public API serves bulk download files and requires a free FCC
              username and hash token. It does not accept a street address.
              Building points and addresses belong to the licensed Broadband
              Serviceable Location Fabric, so this page reports the census
              block, which is the finest public geography available for a live
              lookup.
            </p>
            <p>
              Speed tiers follow the FCC summary: <strong>≥ 100/20 Mbps</strong>{" "}
              (served), <strong>at least 25/3 Mbps and below 100/20 Mbps</strong>{" "}
              (underserved), and <strong>below 25/3 Mbps</strong>. The block
              summary does not include the exact Mbps integer from the
              location-level filing. Counts are broadband-serviceable locations
              in the block where that provider filed that technology.
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
                <a
                  href="https://geocoding.geo.census.gov/geocoder/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Census geocoder
                </a>
              </li>
            </ul>
          </details>
          <p className="foot">
            Queried live for each address. No provider list is stored in this app.
            {result ? ` Last response ${new Date(result.queriedAt).toLocaleString()}.` : ""}
          </p>
        </div>
      </main>
    </>
  );
}
