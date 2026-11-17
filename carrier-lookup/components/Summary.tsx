import { formatNumber, type DashboardSummary } from "@/lib/dashboard";
import type { LookupSuccess } from "@/lib/types";

function placeLine(result: LookupSuccess): string {
  return [
    result.censusBlock.place,
    result.censusBlock.county,
    result.censusBlock.stateAbbr ?? result.censusBlock.state,
  ]
    .filter(Boolean)
    .join(", ");
}

export function ResultHeader({ result }: { result: LookupSuccess }) {
  const place = placeLine(result);
  return (
    <header className="card result-head">
      <p className="eyebrow">Matched address</p>
      <h2 className="address">{result.matchedAddress}</h2>
      <p className="block-line">
        <span>Census block</span>
        <code className="geoid">{result.censusBlock.geoid}</code>
      </p>
      <dl className="facts">
        {place && (
          <div>
            <dt>Place</dt>
            <dd>{place}</dd>
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
        {result.censusBlock.totalPopulation !== null && (
          <div>
            <dt>Population</dt>
            <dd>{formatNumber(result.censusBlock.totalPopulation)}</dd>
          </div>
        )}
        <div>
          <dt>Vintage</dt>
          <dd>{result.vintage.asOf}</dd>
        </div>
      </dl>
      <p className="callout">
        These filings cover the 2020 census block that contains the matched address.
        A provider on this list filed service at one or more broadband-serviceable
        locations in the block. Results are block-level, not per building. Confirm
        the building on the{" "}
        <a href="https://broadbandmap.fcc.gov/" target="_blank" rel="noreferrer">
          National Broadband Map
        </a>{" "}
        when the specific address decides an order. Advertised speeds are the FCC
        tiers published for the block, {result.vintage.asOf}.
      </p>
    </header>
  );
}

export function SummaryCards({ summary }: { summary: DashboardSummary }) {
  const filingLabel = `${formatNumber(summary.filingCount)} technology filing${summary.filingCount === 1 ? "" : "s"}`;
  return (
    <section className="stats" aria-label="Summary">
      <article className="stat">
        <h3 className="stat-label">Providers</h3>
        <p className="stat-value">{formatNumber(summary.providerCount)}</p>
        <p className="stat-hint">{filingLabel} in this block</p>
      </article>
      <article className="stat stat-served">
        <h3 className="stat-label">≥ 100/20 Mbps</h3>
        <p className="stat-value">{formatNumber(summary.servedProviderCount)}</p>
        <p className="stat-hint">Providers filing at least 100 Mbps down and 20 Mbps up</p>
      </article>
      <article className="stat stat-fiber">
        <h3 className="stat-label">Fiber providers</h3>
        <p className="stat-value">{formatNumber(summary.fiberProviderCount)}</p>
        <p className="stat-hint">Providers with a fiber filing in this block</p>
      </article>
      <article className="stat stat-speed">
        <h3 className="stat-label">Fastest advertised</h3>
        <p className="stat-value stat-speed-value">{summary.fastest.readout}</p>
        <p className="stat-unit">{summary.fastest.unit}</p>
        <p className="stat-hint">{summary.fastest.detail}</p>
      </article>
    </section>
  );
}
