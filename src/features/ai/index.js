import "./styles.css";

export function initAiFeature({ app, aiPanel }) {
  let compactPanelMode = "b";
  let isFullSize = false;

  function syncPanelControls() {
    const compactSizeToggle = document.getElementById("compact-size-toggle");
    const fullSizeToggle = document.getElementById("full-size-toggle");

    if (compactSizeToggle) {
      compactSizeToggle.textContent = compactPanelMode === "a" ? "→" : "←";
      compactSizeToggle.setAttribute(
        "aria-label",
        compactPanelMode === "a"
          ? "Switch to left panel"
          : "Switch to minimized panel",
      );
    }

    if (fullSizeToggle) {
      fullSizeToggle.textContent = isFullSize ? "⤡" : "⤢";
      fullSizeToggle.setAttribute(
        "aria-label",
        isFullSize
          ? "Return to compact chat panel"
          : "Toggle full size chat panel",
      );
    }
  }

  function applyCompactPanelMode() {
    aiPanel.classList.toggle("minimized", compactPanelMode === "a");
    aiPanel.classList.toggle("left-panel", compactPanelMode === "b");
  }

  function toggleCompact() {
    compactPanelMode = compactPanelMode === "b" ? "a" : "b";

    if (!isFullSize) {
      applyCompactPanelMode();
    }

    syncPanelControls();
  }

  function toggleFullSize() {
    if (isFullSize) {
      isFullSize = false;
      app.classList.remove("chat-only");
      aiPanel.classList.remove("expanded");
      applyCompactPanelMode();
      aiPanel.style.width = "";
      aiPanel.style.height = "";
      syncPanelControls();
      return;
    }

    isFullSize = true;
    app.classList.add("chat-only");
    aiPanel.classList.add("expanded");
    aiPanel.classList.remove("minimized");
    aiPanel.classList.remove("left-panel");
    aiPanel.style.width = "";
    aiPanel.style.height = "";
    syncPanelControls();
  }

  function initControls() {
    const compactSizeToggle = document.getElementById("compact-size-toggle");
    const fullSizeToggle = document.getElementById("full-size-toggle");
    const sendBtn = document.getElementById("send-btn");

    compactSizeToggle?.addEventListener("click", toggleCompact);
    fullSizeToggle?.addEventListener("click", toggleFullSize);

    sendBtn?.addEventListener("click", () => {
      const input = document.getElementById("ai-input");
      if (!input || !input.value.trim()) return;
      input.value = "";
    });

    applyCompactPanelMode();
    syncPanelControls();
  }

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
