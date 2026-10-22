/**
 * AI Chatbot API Service
 * Connects the Sime Darby GIS Analyst chatbot with LLM APIs (Google Gemini, OpenAI, or custom endpoints).
 * Supports automatic provider detection for Google Gemini (AQ.* and AIzaSy* keys) and OpenAI (sk-* keys).
 * When live API is unavailable or unconfigured, provides a domain-specific GIS analytical fallback.
 */

export const AI_CONFIG = {
  apiKey: (
    import.meta.env.VITE_AI_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    import.meta.env.GEMINI_API_KEY ||
    ''
  ).trim(),
  endpoint: (import.meta.env.VITE_AI_API_ENDPOINT || '').trim(),
  model: (import.meta.env.VITE_AI_MODEL || '').trim(),
  provider: (import.meta.env.VITE_AI_PROVIDER || '').trim().toLowerCase(),
};

/**
 * Detects whether the active key or configuration maps to Google Gemini or OpenAI.
 */
export function getResolvedAiProvider() {
  if (AI_CONFIG.provider) return AI_CONFIG.provider;
  if (
    AI_CONFIG.apiKey.startsWith('AQ.') ||
    AI_CONFIG.apiKey.startsWith('AIzaSy') ||
    AI_CONFIG.endpoint.includes('googleapis.com')
  ) {
    return 'gemini';
  }
  if (AI_CONFIG.apiKey.startsWith('sk-') || AI_CONFIG.endpoint.includes('api.openai.com')) {
    return 'openai';
  }
  // Default to gemini if key is present
  return AI_CONFIG.apiKey ? 'gemini' : 'openai';
}

/**
 * Checks whether a live AI API key is configured.
 */
export function isAiApiConfigured() {
  return Boolean(
    AI_CONFIG.apiKey &&
    AI_CONFIG.apiKey.length > 5 &&
    !AI_CONFIG.apiKey.includes('your_ai_api_key')
  );
}

/**
 * Returns the active AI service configuration for UI or debugging.
 */
export function getAiApiConfig() {
  const provider = getResolvedAiProvider();
  return {
    isConfigured: isAiApiConfigured(),
    endpoint:
      AI_CONFIG.endpoint ||
      (provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent'
        : 'https://api.openai.com/v1/chat/completions'),
    model: AI_CONFIG.model || (provider === 'gemini' ? 'gemini-3.8-flash' : 'gpt-4o-mini'),
    provider,
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

  let lines = [];

  if (context.isLocationAction) {
    lines.push(
      `[MAP ACTION EXECUTED]: The location "${locationName}" has been pinned on the map.`,
      `[ISOCHRONE & AMENITIES PLOTTED]: A ${travelMinutes}-minute ${modeLabel} isochrone catchment is drawn on the map with ${totalPlaces} reachable amenities.`
    );
  }

  lines.push(
    `Current Analysis Location: ${locationName}`,
    `Location Address: ${locationAddress}`,
    `Active Travel Profile: ${travelMinutes}-minute ${modeLabel}`,
    `Reachable Filtered Places: ${totalPlaces}`,
  );

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
 * Local domain-aware GIS analytical fallback when API key is not configured or network fails.
 */
function generateLocalGisResponse(prompt, context = {}) {
  const lower = prompt.toLowerCase();
  const {
    locationName = 'Sime Darby Centre',
    locationAddress = '19 Pudu Road, Bukit Bintang, Kuala Lumpur',
    travelMode = 'walking',
    travelMinutes = 20,
    totalPlaces = 0,
    densityScore = null,
    isComparison = false,
    comparisonResult = null,
    isLocationAction = false,
  } = context;

  const modeLabel = travelMode === 'walking' ? 'walk' : travelMode === 'cycling' ? 'bike ride' : 'drive';

  if (isLocationAction || lower.includes('choose') || lower.includes('pin') || lower.includes('select') || lower.includes('switch to')) {
    const scoreText = densityScore ? ` with a Density Score of ${densityScore.score}/100 (${densityScore.rating || 'Active'}).` : '.';
    return `📍 I have pinned **${locationName}** on the map, mapped its ${travelMinutes}-minute ${modeLabel} isochrone catchment, and plotted ${totalPlaces} reachable amenities.\n\nSpatial & Amenity Analysis for ${locationName}:\n• Reachable Catchment: Within a ${travelMinutes}-minute ${modeLabel}, residents and visitors have access to ${totalPlaces} amenities${scoreText}\n• Connectivity & Transit: Positioned along prime urban corridors with direct pedestrian linkages and multimodal transit access.\n• Urban Vitality: Features a well-distributed mix of retail, daily services, and commercial conveniences suitable for 15-minute city accessibility.`;
  }

  if (isComparison && comparisonResult) {
    const leader = comparisonResult.winner === 'siteB' ? comparisonResult.siteB.name : comparisonResult.siteA.name;
    const diff = Math.abs(comparisonResult.scoreDiff);
    return `Comparison Analysis:\nEvaluating ${comparisonResult.siteA.name} versus ${comparisonResult.siteB.name} under ${travelMinutes}-minute ${modeLabel} reachability:\n\n• Score Leadership: ${leader} leads with a +${diff} point accessibility differential.\n• Site A: ${comparisonResult.statsA?.total ?? 0} reachable amenities (${comparisonResult.densityA?.score ?? 0}/100).\n• Site B: ${comparisonResult.statsB?.total ?? 0} reachable amenities (${comparisonResult.densityB?.score ?? 0}/100).\n\nKey Takeaways: ${comparisonResult.takeaways?.join(' ') || 'Both sites provide distinct spatial advantages.'}`;
  }

  if (lower.includes('walk') || lower.includes('travel') || lower.includes('reach') || lower.includes('minute') || lower.includes('isochrone')) {
    const scoreText = densityScore ? ` achieving a Density Score of ${densityScore.score}/100 (${densityScore.rating}).` : '.';
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

  return `I am Abso, your AI GIS Analyst for Sime Darby Property. Currently examining ${locationName} under a ${travelMinutes}-minute ${modeLabel} catchment with ${totalPlaces} reachable amenities. You can ask me to choose or pin a new location on the map, analyze accessibility scores, evaluate transit corridors, or compare multiple sites.`;
}

/**
 * Calls Google Gemini REST API with automated multi-model fallback.
 */
async function callGeminiApi({ prompt, messages = [], systemInstruction }) {
  const userSpecifiedModel = AI_CONFIG.model;
  // Ordered candidate models with current active versions for Google AI Studio
  const candidateModels = [
    ...(userSpecifiedModel ? [userSpecifiedModel] : []),
    'gemini-3.8-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
  ];

  // De-duplicate model names while preserving order
  const uniqueModels = [...new Set(candidateModels)];

  const historyFormatted = messages.slice(-8).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'model',
    parts: [{ text: m.text }],
  }));

  const payload = {
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    contents: [
      ...historyFormatted,
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 800,
    },
  };

  for (const model of uniqueModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${AI_CONFIG.apiKey}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`Gemini model ${model} responded with status:`, res.status, errorText);
        // Continue to fallback model if 404 or 503 high demand
        continue;
      }

      const data = await res.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

      if (reply) {
        return {
          text: reply,
          source: 'live_api',
          model,
        };
      }
    } catch (err) {
      console.warn(`Gemini API call to ${model} failed:`, err);
    }
  }

  throw new Error('All Gemini models exhausted without a valid response.');
}

/**
 * Calls OpenAI chat completion endpoint.
 */
async function callOpenAiApi({ prompt, messages = [], systemInstruction }) {
  const historyFormatted = messages.slice(-8).map((m) => ({
    role: m.sender === 'user' ? 'user' : 'assistant',
    content: m.text,
  }));

  const endpoint = AI_CONFIG.endpoint || 'https://api.openai.com/v1/chat/completions';
  const model = AI_CONFIG.model || 'gpt-4o-mini';

  const payload = {
    model,
    messages: [
      { role: 'system', content: systemInstruction },
      ...historyFormatted,
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AI_CONFIG.apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.warn('OpenAI API responded with error status:', res.status, errorText);
    throw new Error(`OpenAI API error: HTTP ${res.status}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content?.trim();

  if (!reply) {
    throw new Error('Empty response from OpenAI');
  }

  return {
    text: reply,
    source: 'live_api',
    model,
  };
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
- When a user asks to choose, pin, or analyze a location: confirm you have pinned the location on the map, plotted the travel-time isochrone and reachable amenities, and provide a comprehensive GIS spatial analysis in text covering accessibility, density metrics, transit connectivity, and urban viability.
- Provide concise, professional, and data-informed answers.
- Use English names for all addresses and locations (e.g., Road, Avenue, Central Station, National Museum).
- Do not use emojis in your responses except for the location pin 📍 where designating a coordinate or address.
- Focus on spatial relationships, distances, travel convenience, and urban amenities.`;

  // 1. If API is configured, call the live endpoint
  if (isAiApiConfigured()) {
    try {
      const provider = getResolvedAiProvider();
      if (provider === 'gemini') {
        return await callGeminiApi({
          prompt: trimmedPrompt,
          messages,
          systemInstruction,
        });
      }
      return await callOpenAiApi({
        prompt: trimmedPrompt,
        messages,
        systemInstruction,
      });
    } catch (err) {
      console.warn('Live AI API call failed, falling back to local GIS analyst:', err);
    }
  }

  // 2. Fallback Placeholder: High quality simulated GIS response
  const localResponse = generateLocalGisResponse(trimmedPrompt, context);

  return {
    text: localResponse,
    source: 'placeholder',
    model: AI_CONFIG.apiKey ? 'local-fallback' : 'api-placeholder',
  };
}
