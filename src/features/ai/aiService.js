/**
 * AI Chatbot API Service
 * Connects the Sime Darby GIS Analyst chatbot with LLM APIs (OpenAI, Gemini, Anthropic, or custom endpoints).
 * When VITE_AI_API_KEY is configured in .env, calls the live API endpoint.
 * When not configured, provides a domain-specific GIS analytical fallback with clear placeholder status.
 */

export const AI_CONFIG = {
  apiKey: (import.meta.env.VITE_AI_API_KEY || '').trim(),
  endpoint: (import.meta.env.VITE_AI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions').trim(),
  model: (import.meta.env.VITE_AI_MODEL || 'gpt-4o-mini').trim(),
  provider: (import.meta.env.VITE_AI_PROVIDER || 'openai').trim().toLowerCase(),
};

/**
 * Checks whether a live AI API key is configured.
 */
export function isAiApiConfigured() {
  return Boolean(AI_CONFIG.apiKey && AI_CONFIG.apiKey.length > 5 && !AI_CONFIG.apiKey.includes('your_ai_api_key'));
}

/**
 * Returns the active AI service configuration for UI or debugging.
 */
export function getAiApiConfig() {
  return {
    isConfigured: isAiApiConfigured(),
    endpoint: AI_CONFIG.endpoint,
    model: AI_CONFIG.model,
    provider: AI_CONFIG.provider,
  };
}

/**
 * Formats spatial context into a structured prompt block for the AI.
 */
function buildSpatialContextString(context = {}) {
  const {
    locationName = 'Sime Darby Centre',
    locationAddress = '19 Pudu Road, Bukit Bintang, Kuala Lumpur',
    travelMode = 'walking',
    travelMinutes = 20,
    totalPlaces = 0,
    densityScore = null,
    selectedCategories = [],
    isComparison = false,
    comparisonResult = null,
  } = context;

  const modeLabel = travelMode === 'walking' ? 'Pedestrian Walk' : travelMode === 'cycling' ? 'Bicycle Ride' : 'Vehicle Drive';

  let lines = [
    `Current Analysis Location: ${locationName}`,
    `Location Address: ${locationAddress}`,
    `Active Travel Profile: ${travelMinutes}-minute ${modeLabel}`,
    `Reachable Filtered Places: ${totalPlaces}`,
  ];

  if (densityScore) {
    lines.push(
      `Catchment Area: ${densityScore.areaKm2} sq km`,
      `Density Index: ${densityScore.densityPerKm2} places/km²`,
      `Accessibility Score: ${densityScore.score} / 100 (${densityScore.rating || 'Moderate'})`,
      `Amenity Diversity: ${densityScore.diversityIndex || 'N/A'}`
    );
  }

  if (selectedCategories && selectedCategories.length > 0) {
    lines.push(`Active Category Filters: ${selectedCategories.join(', ')}`);
  }

  if (isComparison && comparisonResult) {
    lines.push(
      `Site Comparison Active:`,
      `- Site A: ${comparisonResult.siteA?.name} (${comparisonResult.densityA?.score ?? 'N/A'} pts, ${comparisonResult.statsA?.total ?? 0} places)`,
      `- Site B: ${comparisonResult.siteB?.name} (${comparisonResult.densityB?.score ?? 'N/A'} pts, ${comparisonResult.statsB?.total ?? 0} places)`,
      `- Evaluated Leader: ${comparisonResult.winner === 'siteB' ? comparisonResult.siteB?.name : comparisonResult.winner === 'siteA' ? comparisonResult.siteA?.name : 'Tie'}`
    );
  }

  return lines.join('\n');
}

/**
 * Local domain-aware GIS analytical fallback when API key is not configured.
 */
function generateLocalGisResponse(prompt, context = {}) {
  const lower = prompt.toLowerCase();
  const {
    locationName = 'Sime Darby Centre',
    travelMode = 'walking',
    travelMinutes = 20,
    totalPlaces = 0,
    densityScore = null,
    isComparison = false,
    comparisonResult = null,
  } = context;

  const modeLabel = travelMode === 'walking' ? 'walk' : travelMode === 'cycling' ? 'bike ride' : 'drive';

  if (isComparison && comparisonResult) {
    const leader = comparisonResult.winner === 'siteB' ? comparisonResult.siteB.name : comparisonResult.siteA.name;
    const diff = Math.abs(comparisonResult.scoreDiff);
    return `Comparison Analysis:\nEvaluating ${comparisonResult.siteA.name} versus ${comparisonResult.siteB.name} under ${travelMinutes}-minute ${modeLabel} reachability:\n\n• Score Leadership: ${leader} leads with a +${diff} point accessibility differential.\n• Site A: ${comparisonResult.statsA?.total ?? 0} reachable amenities (${comparisonResult.densityA?.score ?? 0}/100).\n• Site B: ${comparisonResult.statsB?.total ?? 0} reachable amenities (${comparisonResult.densityB?.score ?? 0}/100).\n\nKey Takeaways: ${comparisonResult.takeaways?.join(' ') || 'Both sites provide distinct spatial advantages.'}`;
  }

  if (lower.includes('walk') || lower.includes('travel') || lower.includes('reach') || lower.includes('minute') || lower.includes('isochrone')) {
    const scoreText = densityScore ? ` achieving a Trustworthy Density Score of ${densityScore.score}/100 (${densityScore.rating}).` : '.';
    return `Within a ${travelMinutes}-minute ${modeLabel} from ${locationName}, our spatial isochrone catchment encompasses ${totalPlaces} reachable amenities${scoreText} The highest concentration is clustered around transit-oriented nodes and mixed-use commercial corridors.`;
  }

  if (lower.includes('shop') || lower.includes('mall') || lower.includes('store') || lower.includes('retail') || lower.includes('grocery')) {
    return `Retail & Shopping Overview around ${locationName}:\nMajor retail destinations in this catchment include Pavilion Kuala Lumpur, Suria KLCC, and The Exchange TRX. These retail hubs offer comprehensive lifestyle, dining, and daily grocery conveniences. Use the 'All' menu in the top bar to filter specific retail categories.`;
  }

  if (lower.includes('transit') || lower.includes('mrt') || lower.includes('lrt') || lower.includes('train') || lower.includes('bus') || lower.includes('station')) {
    return `Public Transit Connectivity at ${locationName}:\nThis zone is serviced by high-capacity transit corridors including the MRT Kajang Line (Bukit Bintang, TRX), the LRT Kelana Jaya Line, and monorail links. Commuters can reach primary employment centres and commercial hubs without vehicle reliance.`;
  }

  if (lower.includes('density') || lower.includes('score') || lower.includes('rating') || lower.includes('15-min') || lower.includes('fifteen')) {
    if (densityScore) {
      return `Spatial Density Evaluation for ${locationName}:\n• Overall Score: ${densityScore.score} / 100 (${densityScore.rating})\n• Catchment Area: ${densityScore.areaKm2} km²\n• Amenity Density: ${densityScore.densityPerKm2} places / km²\n• Category Diversity: ${densityScore.diversityIndex}\n\nThis reflects ${densityScore.rating.toLowerCase()} urban vitality according to standard 15-minute city criteria.`;
    }
    return `Click 'Run Analysis' in the Time Travel tab to calculate the real-time density score and 15-minute city accessibility rating for ${locationName}.`;
  }

  if (lower.includes('export') || lower.includes('pdf') || lower.includes('csv') || lower.includes('report') || lower.includes('download')) {
    return `You can generate executive reports directly from the interface: click 'Export PDF Report' in the Time Travel panel or use the Export button at top right to download high-resolution PNG maps, executive PDF analysis sheets, or filtered CSV datasets.`;
  }

  return `I am Abso, your AI GIS Analyst for Sime Darby Property. Currently examining ${locationName} under a ${travelMinutes}-minute ${modeLabel} catchment with ${totalPlaces} reachable amenities. You can ask me about accessibility scores, transit corridors, retail reach, or compare multiple sites.`;
}

/**
 * Sends a chat message to the configured AI API or fallback placeholder.
 *
 * @param {Object} params
 * @param {string} params.prompt - The user's input prompt.
 * @param {Array} params.messages - Chat history [{ sender: 'user'|'bot', text: string }].
 * @param {Object} params.context - Spatial GIS context (location, travel mode, minutes, density, etc.).
 * @returns {Promise<{ text: string, source: 'live_api'|'placeholder', model: string }>}
 */
export async function callAiChatApi({ prompt, messages = [], context = {} }) {
  const trimmedPrompt = String(prompt || '').trim();
  if (!trimmedPrompt) {
    return { text: 'Please enter a question or command.', source: 'placeholder', model: 'local' };
  }

  const spatialContext = buildSpatialContextString(context);

  const systemInstruction = `You are Abso, an expert AI GIS and Spatial Analytics assistant for Sime Darby Property.
You assist urban planners, real estate investment analysts, and property developers with:
- 15-minute city accessibility and travel time isochrones (walking, cycling, driving)
- Amenities density and catchment distribution analysis
- Multimodal transit connectivity (MRT, LRT, KTM, Monorail)
- Dual-site comparative accessibility evaluations

Current Spatial Analytics Context:
${spatialContext}

Guidelines:
- Provide concise, professional, and data-informed answers.
- Use English names for all addresses and locations (e.g., Road, Avenue, Central Station, National Museum).
- Do not use emojis in your responses except for the location pin 📍 where designating a coordinate or address.
- Focus on spatial relationships, distances, travel convenience, and urban amenities.`;

  // 1. If API is configured, call the live endpoint
  if (isAiApiConfigured()) {
    try {
      const historyFormatted = messages.slice(-8).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const payload = {
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: systemInstruction },
          ...historyFormatted,
          { role: 'user', content: trimmedPrompt },
        ],
        temperature: 0.7,
        max_tokens: 600,
      };

      const res = await fetch(AI_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn('AI API responded with error status:', res.status, errorText);
        throw new Error(`AI API error: HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content?.trim();

      if (reply) {
        return {
          text: reply,
          source: 'live_api',
          model: AI_CONFIG.model,
        };
      }
    } catch (err) {
      console.warn('Live AI API call failed, falling back to local GIS analyst:', err);
    }
  }

  // 2. Fallback Placeholder: High quality simulated GIS response with placeholder notice
  const localResponse = generateLocalGisResponse(trimmedPrompt, context);

  return {
    text: localResponse,
    source: 'placeholder',
    model: AI_CONFIG.apiKey ? 'local-fallback' : 'api-placeholder',
  };
}
