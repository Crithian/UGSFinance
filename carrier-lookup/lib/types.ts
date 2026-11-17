export type TechnologyGroup =
  | "fiber"
  | "cable"
  | "dsl"
  | "fixed_wireless"
  | "satellite"
  | "other";

export type SpeedTier = "served" | "underserved" | "unserved";

export type ProviderFiling = {
  providerName: string;
  frn: string;
  technologyCode: number;
  technology: string;
  technologyDetail: string;
  technologyGroup: TechnologyGroup;
  locationsReported: number;
  servedLocations: number;
  underservedLocations: number;
  unservedLocations: number;
  bestTier: SpeedTier | null;
};

export type AddressMatch = {
  matchedAddress: string;
  latitude: number;
  longitude: number;
  blockGeoid: string;
  blockName: string | null;
  tractGeoid: string | null;
  county: string | null;
  state: string | null;
  stateAbbr: string | null;
  place: string | null;
};

export type BlockSummary = {
  totalLocations: number | null;
  totalPopulation: number | null;
  uniqueProviders: number | null;
  county: string | null;
  state: string | null;
  stateAbbr: string | null;
};

export type Vintage = {
  label: string;
  asOf: string;
  summary: string;
};

export type LookupSuccess = {
  status: "ok";
  queriedAt: string;
  resolution: "census_block";
  matchedAddress: string;
  latitude: number;
  longitude: number;
  censusBlock: {
    geoid: string;
    name: string | null;
    tractGeoid: string | null;
    county: string | null;
    state: string | null;
    stateAbbr: string | null;
    place: string | null;
    totalLocations: number | null;
    totalPopulation: number | null;
    uniqueProviders: number | null;
  };
  vintage: Vintage;
  providers: ProviderFiling[];
};

export type LookupAmbiguous = {
  status: "ambiguous";
  matches: AddressMatch[];
  truncated: boolean;
};

export type LookupResponse = LookupSuccess | LookupAmbiguous;

export type LookupErrorBody = {
  error: string;
  code: "invalid" | "no_match" | "upstream";
};
