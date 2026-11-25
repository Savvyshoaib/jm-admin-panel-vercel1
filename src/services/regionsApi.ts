/** UK Land Registry UKHPI regions (SPARQL). */
import { USE_MOCK_DATA } from "@/services/mockFlags";

export type LandRegistryRegion = {
  /** Slug sent to the property API, e.g. `amber-valley`. */
  value: string;
  /** Display label, e.g. `Amber Valley`. */
  label: string;
  /** Full region URI from the Land Registry graph. */
  uri: string;
};

const MOCK_REGIONS: LandRegistryRegion[] = [
  ["greater-london", "Greater London"],
  ["greater-manchester", "Greater Manchester"],
  ["west-midlands", "West Midlands"],
  ["west-yorkshire", "West Yorkshire"],
  ["merseyside", "Merseyside"],
  ["south-west", "South West"],
  ["south-east", "South East"],
  ["east-of-england", "East of England"],
].map(([value, label]) => ({
  value,
  label,
  uri: `http://landregistry.data.gov.uk/id/region/${value}`,
}));

type SparqlBinding = {
  type: string;
  value: string;
  "xml:lang"?: string;
};

type SparqlResponse = {
  results?: {
    bindings?: Array<{
      region?: SparqlBinding;
      regionName?: SparqlBinding;
    }>;
  };
};

const REGIONS_QUERY = `
PREFIX ukhpi: <http://landregistry.data.gov.uk/def/ukhpi/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?region ?regionName
WHERE {
  ?observation ukhpi:refRegion ?region .
  ?region rdfs:label ?regionName .
  FILTER (lang(?regionName) = "en")
}
ORDER BY ?regionName
`.trim();

const LAND_REGISTRY_QUERY_URL =
  "https://landregistry.data.gov.uk/landregistry/query";

export function regionSlugFromUri(uri: string): string {
  const trimmed = uri.trim().replace(/\/+$/, "");
  const slash = trimmed.lastIndexOf("/");
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed;
}

export async function fetchLandRegistryRegions(): Promise<LandRegistryRegion[]> {
  if (USE_MOCK_DATA) return MOCK_REGIONS;
  const url = `${LAND_REGISTRY_QUERY_URL}?query=${encodeURIComponent(REGIONS_QUERY)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/sparql-results+json",
    },
  });

  if (!res.ok) {
    throw new Error(`Unable to load regions (${res.status}).`);
  }

  const data = (await res.json()) as SparqlResponse;
  const bindings = data.results?.bindings ?? [];
  const seen = new Set<string>();
  const regions: LandRegistryRegion[] = [];

  for (const row of bindings) {
    const uri = row.region?.value?.trim();
    const label = row.regionName?.value?.trim();
    if (!uri || !label) continue;
    const value = regionSlugFromUri(uri);
    if (!value || seen.has(value)) continue;
    seen.add(value);
    regions.push({ value, label, uri });
  }

  return regions;
}
