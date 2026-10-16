import catalog from "./catalog.json";
export const { sites, strategies } = catalog;
export const prompts = [
  [
    "Low-carbon walkway",
    "Plan a 500 m recycled permeable walkway with a budget of RM 150,000 and at least 30% carbon reduction.",
  ],
  [
    "Development potential",
    "What development should we consider here? Compare transit access, terrain and flood constraints.",
  ],
  [
    "Retrofit a building",
    "How can we retrofit an existing building to reduce embodied carbon and improve stormwater management?",
  ],
];
export function buildDemo({
  site_id,
  strategy_id,
  length,
  width,
  budget,
  carbon_target,
}) {
  const site = sites.find((s) => s.id === site_id);
  const strategy = strategies.find((s) => s.id === strategy_id);
  const area = length * width;
  const cost = Math.round(area * strategy.rate);
  const reduction = Math.round((1 - strategy.carbon / strategy.baseline) * 100);
  return {
    mode: "demo",
    response_text: `${site.name}: ${strategy.recommendation} This concept uses ${area.toLocaleString()} m² and illustrative rates. The estimated scope ${cost <= budget ? "fits" : "exceeds"} your budget; the carbon target is ${reduction >= carbon_target ? "met" : "not met"} under these assumptions. Terrain, flood exposure, transit access and permitted land use require verified site data.`,
    action_zone: {
      zone_name: site.name + " · illustrative study area",
      coordinates: site.coordinates,
      highlight_color: "#36b890",
    },
    kpi_metrics: {
      estimated_cost: cost,
      carbon_reduction: reduction,
      carbon_saved: Math.round(area * (strategy.baseline - strategy.carbon)),
      flood_resilience_boost: null,
      payback_period: null,
    },
    assumptions: [
      `Study area: ${length} × ${width} m = ${area} m²; polygon is schematic, not surveyed.`,
      `Illustrative installed rate: RM ${strategy.rate}/m². Excludes land, tax, fees and site-specific work.`,
      `Embodied carbon: ${strategy.baseline} → ${strategy.carbon} kgCO₂e/m² for this intervention only, not whole-building emissions.`,
      "No measured flood, elevation, transport or zoning datasets connected.",
    ],
  };
}
export async function requestAnalysis(input) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(
      typeof error?.detail === "string"
        ? error.detail
        : "AI service unavailable. Start the Python backend and check GEMINI_API_KEY, then retry.",
    );
  }
  const result = await response.json();
  if (
    typeof result.response_text !== "string" ||
    !result.kpi_metrics ||
    !Array.isArray(result.action_zone?.coordinates) ||
    !Array.isArray(result.assumptions)
  )
    throw new Error("Invalid analysis response. Please try again.");
  return result;
}
