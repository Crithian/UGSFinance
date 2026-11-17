# Carrier Lookup

Staff dashboard for an internet and VoIP desk. Enter a U.S. street address and see the fixed broadband providers that filed service for the census block containing that address: summary counts, speed and technology charts, and each provider’s technology and advertised speed tier.

Lookups run live on each search. The app does not ship with a provider database.

## What you get back

For a matched address the dashboard shows:

- The Census Bureau’s normalized address and the 2020 census block GEOID, plus place, coordinates, and how many broadband-serviceable locations are in the block
- Summary cards: providers in the block, how many offer at least 100/20 Mbps, how many file fiber, and the fastest advertised tier (the block summary does not include an exact Mbps integer)
- A bar chart of providers by their best speed tier and a donut of providers by technology
- One row per provider and technology: fiber, cable, DSL (copper), fixed wireless, satellite, or other
- The max advertised speed as an FCC tier, plus how many locations in the block were filed at that tier
- A technology filter, a carrier-name filter, and sortable columns
- Loading, empty, and error states when a search is in progress, the address does not match, or an upstream service fails

Results are **census-block** filings. A provider on the list filed service at one or more locations in the block. That is the finest geography the public FCC data can answer live. It is not a promise that the provider serves the specific building.

## Data sources

| Step | Source | Auth |
| --- | --- | --- |
| Address suggestions | [Esri World Geocoding `suggest`](https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest) | None |
| Address match, coordinates, census block | [U.S. Census Bureau Geocoder](https://geocoding.geo.census.gov/geocoder/) (`Public_AR_Current` / `Current_Current`) | None |
| Providers, technology, speed tier, location counts | [FCC Broadband Data Collection December 2025 (Latest)](https://www.arcgis.com/home/item.html?id=e1343efcefc344709057260ee57290a0), Esri Living Atlas feature service | None |

The provider table is layer `7` (`BDC Records for Blocks`) and the block summary is layer `4` (`Blocks`) on:

`https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer`

Esri’s item title is read at runtime, so the vintage label follows the published layer (currently December 2025). Copyright on the underlying filings is the Federal Communications Commission. The feature service is Esri’s public republication of that FCC summary.

### Why this is block-level

The [FCC BDC public API](https://broadbandmap.fcc.gov/api/public/map) is a bulk-file API. With a free account it can list as-of dates and download statewide availability files. Those files are keyed by Broadband Serviceable Location `location_id`, not by street address. The address and coordinates for a location live in the Broadband Serviceable Location Fabric, which is licensed (CostQuest). The National Broadband Map website can search an address because it is allowed to use the fabric. Scripted use of the fabric endpoints is not a public API, and `broadbandmap.fcc.gov` also rejects many cloud and datacenter networks (Akamai HTTP 403), which rules it out for a Vercel deployment.

This app therefore does the closest reliable live lookup:

1. Geocode the address with the Census Bureau and read the 2020 census block.
2. Query the FCC block summary for every provider and technology filed in that block.

Speed figures in that summary are tiers, not the exact Mbps integer stored on the location-level filing:

- **≥ 100 Mbps down / 20 Mbps up** (`ServedBSLs`)
- **At least 25/3 Mbps and below 100/20 Mbps** (`UnderservedBSLs`)
- **Below 25/3 Mbps** (`UnservedBSLs`)

The page says so. It does not invent a plan speed.

### Keys

**This app does not need an API key.** Nothing is read from the environment, and nothing is hardcoded.

The official bulk API, if you want the raw location-level files yourself, uses:

| Variable | Meaning |
| --- | --- |
| `FCC_BDC_USERNAME` | Username of a free National Broadband Map account |
| `FCC_BDC_HASH` | API token (`hash_value`) from that account |

How to obtain them:

1. Create an account at [broadbandmap.fcc.gov/login](https://broadbandmap.fcc.gov/login).
2. Open **Manage API Access** and generate a token.
3. Send the username and token as HTTP headers `username` and `hash_value`.

Documented operations (specification: [BDC public data API swagger](https://us-fcc.app.box.com/v/bdc-public-data-api-swagger)):

- `GET /api/public/map/listAsOfDates`
- `GET /api/public/map/downloads/listAvailabilityData/{as_of_date}`
- `GET /api/public/map/downloads/downloadFile/availability/{file_id}/1`

Those calls download files. They still do not accept a street address, and the host often blocks server-side calls from cloud networks. This app does not call them.

Technology codes follow the FCC BDC dictionary: `10` copper/DSL, `40` cable, `50` fiber, `60` geostationary satellite, `61` non-geostationary satellite, `70` unlicensed fixed wireless, `71` licensed fixed wireless, `72` licensed-by-rule fixed wireless, `0` other.

## Run locally

Node.js 20 or newer.

```bash
cd carrier-lookup
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Try `350 Fifth Avenue, New York, NY 10118`.

```bash
npm run build
npm start
```

API routes, both uncached:

- `GET /api/suggest?q=350%20Fifth%20Avenue%20New%20York`
- `GET /api/lookup?address=350%20Fifth%20Avenue,%20New%20York,%20NY%2010118`

`/api/lookup` also accepts `block` (15-digit GEOID) when several Census matches come back and the user picks one.

## Deploy

The app is a Next.js App Router project and deploys to Vercel with no environment variables.

1. Import the repository in Vercel.
2. Set the **Root Directory** to `carrier-lookup`.
3. Framework preset: Next.js. Build command `npm run build`, output handled by Next.js.
4. Deploy. Do not add `FCC_BDC_USERNAME` or `FCC_BDC_HASH`; the running app does not read them.

Any Node host works the same way: `npm install`, `npm run build`, `npm start` from `carrier-lookup`. The server must be able to reach `geocoding.geo.census.gov`, `geocode.arcgis.com`, and `services8.arcgis.com`.

## Notes for staff

- Satellite and fixed-wireless brands often file an entire block. A wired provider may file only some of the locations. Read the location count on the row.
- When a filing is split across speed tiers, the row shows the fastest tier and how many locations are slower.
- An address with a Census match and an empty table means the FCC summary has no fixed-broadband filing for that block.
- Re-check the building on the [National Broadband Map](https://broadbandmap.fcc.gov/) before telling a customer a provider serves that door.
