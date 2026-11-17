import { bestTier, technologyInfo } from "./technologies";
import type {
  AddressMatch,
  BlockSummary,
  LookupResponse,
  ProviderFiling,
  Vintage,
} from "./types";

const USER_AGENT = "carrier-lookup/1.0 (staff broadband availability lookup)";

const CENSUS_URL =
  "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress";

const SUGGEST_URL =
  "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest";

/** Esri Living Atlas view of the FCC Broadband Data Collection. */
const FEATURE_SERVER =
  "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer";

const ITEM_URL =
  "https://www.arcgis.com/sharing/rest/content/items/e1343efcefc344709057260ee57290a0?f=json";

const BLOCK_RECORDS_LAYER = 7;
const BLOCKS_LAYER = 4;

const FALLBACK_VINTAGE: Vintage = {
  label: "FCC Broadband Data Collection December 2025 (Latest)",
  asOf: "December 2025",
  summary:
    "FCC Broadband Data Collection fixed-broadband filings, summarized to census blocks and published by Esri.",
};

export class LookupError extends Error {
  constructor(
    public code: "invalid" | "no_match" | "upstream",
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "LookupError";
  }
}

type Json = Record<string, unknown>;

function asRecord(value: unknown): Json | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Json;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": USER_AGENT,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.status >= 500 && attempt === 0) {
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === 1) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

function geoList(geographies: Json, needle: string): Json[] {
  const key = Object.keys(geographies).find((name) =>
    name.toLowerCase().includes(needle.toLowerCase()),
  );
  if (!key) return [];
  return asArray(geographies[key])
    .map(asRecord)
    .filter((row): row is Json => row !== null);
}

function parseMatch(raw: Json): AddressMatch | null {
  const matchedAddress = asString(raw.matchedAddress);
  const coordinates = asRecord(raw.coordinates);
  const longitude = coordinates ? asNumber(coordinates.x) : null;
  const latitude = coordinates ? asNumber(coordinates.y) : null;
  const geographies = asRecord(raw.geographies);
  if (!matchedAddress || latitude === null || longitude === null || !geographies) {
    return null;
  }

  const block = geoList(geographies, "Census Blocks")[0];
  const blockGeoid = block ? asString(block.GEOID) : null;
  if (!blockGeoid || !/^\d{15}$/.test(blockGeoid)) return null;

  const county = geoList(geographies, "Counties")[0];
  const state = geoList(geographies, "States")[0];
  const tract = geoList(geographies, "Census Tracts")[0];
  const place = geoList(geographies, "Incorporated Places")[0];

  return {
    matchedAddress,
    latitude,
    longitude,
    blockGeoid,
    blockName: block ? asString(block.NAME) : null,
    tractGeoid: tract ? asString(tract.GEOID) : null,
    county: county ? asString(county.NAME) : null,
    state: state ? asString(state.NAME) : null,
    stateAbbr: state ? asString(state.STUSAB) : null,
    place: place ? asString(place.BASENAME) ?? asString(place.NAME) : null,
  };
}

export async function suggestAddresses(query: string): Promise<string[]> {
  const text = query.trim().replace(/\s+/g, " ");
  if (text.length < 3 || text.length > 160) return [];

  const url = new URL(SUGGEST_URL);
  url.searchParams.set("text", text);
  url.searchParams.set("f", "json");
  url.searchParams.set("countryCode", "USA");
  url.searchParams.set("category", "Address");
  url.searchParams.set("maxSuggestions", "6");

  try {
    const payload = asRecord(await fetchJson(url.toString(), 8000));
    if (!payload || payload.error) return [];
    const suggestions = asArray(payload.suggestions)
      .map(asRecord)
      .map((row) => (row ? asString(row.text) : null))
      .filter((value): value is string => Boolean(value));
    return [...new Set(suggestions)].slice(0, 6);
  } catch {
    return [];
  }
}

async function geocodeAddress(address: string): Promise<AddressMatch[]> {
  const url = new URL(CENSUS_URL);
  url.searchParams.set("address", address);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("vintage", "Current_Current");
  url.searchParams.set("format", "json");

  let payload: unknown;
  try {
    payload = await fetchJson(url.toString(), 12000);
  } catch {
    throw new LookupError(
      "upstream",
      "The Census geocoder did not respond. Try the address again in a moment.",
      502,
    );
  }

  const result = asRecord(asRecord(payload)?.result);
  const rawMatches = asArray(result?.addressMatches).map(asRecord).filter((row): row is Json => row !== null);
  const matches = rawMatches
    .map((row) => parseMatch(row))
    .filter((row): row is AddressMatch => row !== null);

  if (rawMatches.length > 0 && matches.length === 0) {
    throw new LookupError(
      "upstream",
      "The Census matched that address but did not return a 2020 census block for it.",
      502,
    );
  }

  return matches;
}

function arcgisQuery(layer: number, where: string, outFields: string): string {
  const url = new URL(`${FEATURE_SERVER}/${layer}/query`);
  url.searchParams.set("where", where);
  url.searchParams.set("outFields", outFields);
  url.searchParams.set("returnGeometry", "false");
  url.searchParams.set("f", "json");
  url.searchParams.set("resultRecordCount", "2000");
  return url.toString();
}

async function queryFeatures(url: string): Promise<Json[]> {
  const features: Json[] = [];
  let offset = 0;

  for (let page = 0; page < 5; page += 1) {
    const pageUrl = new URL(url);
    if (offset > 0) pageUrl.searchParams.set("resultOffset", String(offset));
    const payload = asRecord(await fetchJson(pageUrl.toString(), 15000));
    if (!payload) throw new Error("Empty broadband response");
    if (payload.error) {
      const message = asString(asRecord(payload.error)?.message) ?? "Broadband query failed";
      throw new Error(message);
    }
    const rows = asArray(payload.features)
      .map(asRecord)
      .map((feature) => (feature ? asRecord(feature.attributes) : null))
      .filter((row): row is Json => row !== null);
    features.push(...rows);
    if (payload.exceededTransferLimit !== true || rows.length === 0) break;
    offset += rows.length;
  }

  return features;
}

async function fetchBlockSummary(geoid: string): Promise<BlockSummary | null> {
  const url = arcgisQuery(
    BLOCKS_LAYER,
    `GEOID='${geoid}'`,
    "GEOID,CountyName,StateName,StateAbbr,TotalBSLs,TotalPop,UniqueProviders",
  );
  const rows = await queryFeatures(url);
  const row = rows[0];
  if (!row) return null;
  return {
    totalLocations: asNumber(row.TotalBSLs),
    totalPopulation: asNumber(row.TotalPop),
    uniqueProviders: asNumber(row.UniqueProviders),
    county: asString(row.CountyName),
    state: asString(row.StateName),
    stateAbbr: asString(row.StateAbbr),
  };
}

async function fetchProviders(geoid: string): Promise<ProviderFiling[]> {
  const url = arcgisQuery(
    BLOCK_RECORDS_LAYER,
    `GEOID='${geoid}'`,
    "GEOID,ProviderName,FRN,Technology,TotalBSLs,UnservedBSLs,UnderservedBSLs,ServedBSLs",
  );
  const rows = await queryFeatures(url);
  const merged = new Map<string, ProviderFiling>();

  for (const row of rows) {
    const providerName = asString(row.ProviderName);
    const technologyCode = asNumber(row.Technology);
    if (!providerName || technologyCode === null) continue;
    const info = technologyInfo(technologyCode);
    const frn = asString(row.FRN) ?? "";
    const key = `${frn}|${technologyCode}|${providerName.toLowerCase()}`;
    const served = asNumber(row.ServedBSLs) ?? 0;
    const underserved = asNumber(row.UnderservedBSLs) ?? 0;
    const unserved = asNumber(row.UnservedBSLs) ?? 0;
    const reported = asNumber(row.TotalBSLs) ?? served + underserved + unserved;
    const existing = merged.get(key);
    if (existing) {
      existing.locationsReported += reported;
      existing.servedLocations += served;
      existing.underservedLocations += underserved;
      existing.unservedLocations += unserved;
      existing.bestTier = bestTier(
        existing.servedLocations,
        existing.underservedLocations,
        existing.unservedLocations,
      );
      continue;
    }
    merged.set(key, {
      providerName,
      frn,
      technologyCode,
      technology: info.technology,
      technologyDetail: info.technologyDetail,
      technologyGroup: info.group,
      locationsReported: reported,
      servedLocations: served,
      underservedLocations: underserved,
      unservedLocations: unserved,
      bestTier: bestTier(served, underserved, unserved),
    });
  }

  return [...merged.values()];
}

let vintageCache: { at: number; vintage: Vintage } | null = null;

function vintageFromTitle(title: string): Vintage {
  const dated = title.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/,
  );
  return {
    label: title,
    asOf: dated?.[0] ?? "the latest published vintage",
    summary:
      "FCC Broadband Data Collection fixed-broadband filings, summarized to census blocks and published by Esri.",
  };
}

async function getVintage(): Promise<Vintage> {
  if (vintageCache && Date.now() - vintageCache.at < 24 * 60 * 60 * 1000) {
    return vintageCache.vintage;
  }
  try {
    const payload = asRecord(await fetchJson(ITEM_URL, 8000));
    const title = payload ? asString(payload.title) : null;
    const vintage = title ? vintageFromTitle(title) : FALLBACK_VINTAGE;
    vintageCache = { at: Date.now(), vintage };
    return vintage;
  } catch {
    return vintageCache?.vintage ?? FALLBACK_VINTAGE;
  }
}

export async function lookupAddress(
  rawAddress: string,
  blockGeoid?: string,
): Promise<LookupResponse> {
  const address = rawAddress.trim().replace(/\s+/g, " ");
  if (address.length < 5 || address.length > 200) {
    throw new LookupError(
      "invalid",
      "Enter a U.S. street address with city and state, or a ZIP code.",
      400,
    );
  }
  if (blockGeoid && !/^\d{15}$/.test(blockGeoid)) {
    throw new LookupError("invalid", "That census block id is not valid.", 400);
  }

  const vintagePromise = getVintage();
  const matches = await geocodeAddress(address);
  const selected = blockGeoid
    ? matches.filter((match) => match.blockGeoid === blockGeoid)
    : matches;

  if (selected.length === 0) {
    throw new LookupError(
      "no_match",
      "The Census geocoder did not match that address. Use a full street address, city, and state.",
      404,
    );
  }

  if (selected.length > 1) {
    return {
      status: "ambiguous",
      matches: selected.slice(0, 8),
      truncated: selected.length > 8,
    };
  }

  const match = selected[0];
  let providers: ProviderFiling[];
  let block: BlockSummary | null;
  let vintage: Vintage;
  try {
    [providers, block, vintage] = await Promise.all([
      fetchProviders(match.blockGeoid),
      fetchBlockSummary(match.blockGeoid),
      vintagePromise,
    ]);
  } catch {
    throw new LookupError(
      "upstream",
      "The FCC broadband summary did not respond. Try this address again in a moment.",
      502,
    );
  }

  return {
    status: "ok",
    queriedAt: new Date().toISOString(),
    resolution: "census_block",
    matchedAddress: match.matchedAddress,
    latitude: match.latitude,
    longitude: match.longitude,
    censusBlock: {
      geoid: match.blockGeoid,
      name: match.blockName,
      tractGeoid: match.tractGeoid,
      county: block?.county ?? match.county,
      state: block?.state ?? match.state,
      stateAbbr: block?.stateAbbr ?? match.stateAbbr,
      place: match.place,
      totalLocations: block?.totalLocations ?? null,
      totalPopulation: block?.totalPopulation ?? null,
      uniqueProviders: block?.uniqueProviders ?? null,
    },
    vintage,
    providers,
  };
}
