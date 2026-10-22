/**
 * Security Guardrails and Intent Classification for Sime Darby GIS AI Assistant.
 * Defends against:
 * - SQL Injection patterns
 * - Prompt Injection / Jailbreaks / Instruction Overrides
 * - XSS / Script Injections
 * - Unrelated / Out-of-domain queries
 * Detects:
 * - Accessibility Analysis requests and extracts parameters (mode, minutes, location)
 */

import { PRESET_LOCATIONS } from '../map/placesData.js';

// ============================================================================
// 1. SQL INJECTION DEFENSE PATTERNS
// ============================================================================
const SQLI_PATTERNS = [
  // Tautologies / Classic boolean injection (e.g. ' OR '1'='1, " OR ""=", 1=1)
  /('|"|`)\s*(or|and)\s*('|"|`|[\d\w])+\s*=\s*('|"|`|[\d\w])+/i,
  /\b(or|and)\s+\d+\s*=\s*\d+\b/i,
  /\b(or|and)\s+['"][^'"]+['"]\s*=\s*['"][^'"]+['"]/i,

  // Dangerous Data Manipulation / Schema Commands
  /\b(union\s+(all\s+)?select)\b/i,
  /\bselect\b[\s\S]+\bfrom\b[\s\S]+\b(where|limit|group|order)\b/i,
  /\b(drop|truncate|alter)\s+(table|database|schema|view|procedure|trigger)\b/i,
  /\b(delete\s+from|insert\s+into|update\s+\w+\s+set)\b/i,
  /\b(exec|execute)\s*(\(|xp_)/i,
  /\bcast\s*\([\s\S]+as\s+(varchar|int|char|text)\b/i,

  // Database metadata / time delay probing
  /\b(information_schema|sys\.databases|sys\.tables|pg_catalog|sqlite_master)\b/i,
  /\b(waitfor\s+delay|benchmark\s*\(|pg_sleep\s*\(|sleep\s*\()/i,

  // SQL comments combined with semicolons or dangerous tokens
  /;\s*(--|#|\/\*)/i,
  /(--\s*$|\/\*[\s\S]*?\*\/)/,
  /['"]\s*;\s*(--|drop|select|insert|update|delete)\b/i,
];

// ============================================================================
// 2. PROMPT INJECTION & JAILBREAK DEFENSE PATTERNS
// ============================================================================
const PROMPT_INJECTION_PATTERNS = [
  // Direct instruction override attempts
  /\b(ignore|disregard|forget|override|bypass)\s+(all\s+)?(previous|prior|above|system|developer|initial)\s+(instructions|prompts|rules|commands|guidelines|context)\b/i,
  /\b(forget|ignore)\s+(everything\s+)?(you\s+(were|have\s+been)\s+told|prior\s+instructions)\b/i,
  /\b(system|developer|admin|root)\s+(prompt|override|instructions|mode|token)\b/i,

  // Jailbreak personas and modes
  /\byou\s+are\s+now\s+(dan|unfiltered|jailbroken|unrestricted|free|chaos|evil|in\s+developer\s+mode)\b/i,
  /\b(enter|switch\s+to|enable)\s+(developer\s+mode|god\s+mode|unfiltered\s+mode|dan\s+mode)\b/i,
  /\bpretend\s+(you\s+have\s+no|you\s+are\s+not\s+bound\s+by)\s+(rules|restrictions|limits|ethics|guidelines)\b/i,
  /\bact\s+as\s+(an\s+uncensored|an\s+unfiltered|a\s+rogue|an\s+evil)\b/i,

  // System prompt extraction / leakage
  /\b(reveal|show|display|output|print|repeat|tell\s+me)\s+(your\s+)?(system\s+prompt|initial\s+prompt|secret\s+instructions|instructions\s+above)\b/i,
  /\bwhat\s+(is|are)\s+your\s+(system\s+prompt|initial\s+instructions|hidden\s+rules)\b/i,

  // Delimiter & Token injection
  /\[\s*\/?INST\s*\]/i,
  /<\|(?:im_start|im_end|endoftext)\|>/i,
  /<\/?system>/i,
  /###\s*(?:Instruction|System|Human|Assistant):/i,

  // Script & XSS injection
  /<script\b[^>]*>[\s\S]*?<\/script>/i,
  /<script\b[^>]*>/i,
  /javascript\s*:/i,
  /data\s*:\s*text\/html/i,
  /onerror\s*=\s*['"][^'"]*['"]/i,
  /onload\s*=\s*['"][^'"]*['"]/i,
];

// ============================================================================
// 3. DOMAIN RELEVANCE PATTERNS (GIS, URBAN MOBILITY, SIME DARBY, ACCESSIBILITY)
// ============================================================================
const GIS_DOMAIN_PATTERNS = [
  // Core spatial & isochrone terminology
  /\b(gis|map|mapping|isochrone|catchment|spatial|accessibility|accessible|reachability|reachable|reach|walkability|connectivity|boundary|polygon|perimeter|area|sq\s*km|km2)\b/i,
  /\b(distance|radius|meter|meters|km|kilometer|kilometers|coordinates|latitude|longitude|lat|lng|pin|marker)\b/i,

  // Modes & travel time
  /\b(walk|walking|pedestrian|sidewalk|footpath|covered\s+walkway|rain\s+cover|shelter)\b/i,
  /\b(bike|biking|bicycle|cycling|cycle|bike\s+lane)\b/i,
  /\b(drive|driving|car|vehicle|road|highway|traffic)\b/i,
  /\b(transit|public\s+transport|bus|mrt|lrt|ktm|monorail|train|station|interchange|hub|commute|commuter)\b/i,
  /\b(\d+|ten|twenty|thirty|fifteen|five)\s*(-|\s*)?(min|minute|minutes)\b/i,
  /\b(15-minute|15\s*min|twenty\s*min|30\s*min)\s+(city|neighbourhood|neighborhood|reach|radius)\b/i,

  // Amenities & POIs
  /\b(amenity|amenities|poi|pois|density|score|rating|distribution|cluster)\b/i,
  /\b(restaurant|cafe|dining|food|eatery|retail|shop|shopping|mall|store|supermarket|grocery|mart|market)\b/i,
  /\b(school|kindergarten|primary|secondary|university|college|education|tuition|campus|academy)\b/i,
  /\b(hospital|clinic|medical|doctor|healthcare|pharmacy|park|greenery|recreation|gym|bank|atm|hotel)\b/i,

  // Property & Sime Darby context
  /\b(sime\s*darby|property|real\s*estate|developer|development|urban\s*planning|masterplan|township)\b/i,
  /\b(site|location|parcel|lot|address|compare|comparison|site\s*a|site\s*b|export|pdf|report|csv)\b/i,

  // Sustainability & Carbon
  /\b(sustainability|sustainable|carbon|co2|co2e|emissions|footprint|embodied|operational|green|ev|electric\s*car|grid)\b/i,

  // Malaysian locations & landmarks
  /\b(malaysia|kuala\s*lumpur|kl|selangor|bukit\s*bintang|klcc|petronas|trx|the\s*exchange|kl\s*sentral|mid\s*valley|bangsar|subang|subang\s*jaya|shah\s*alam|petaling\s*jaya|pj|damansara|cheras|ampang|pudu|mont\s*kiara|hartamas|cyberjaya|putrajaya|brickfields)\b/i,

  // Standard greetings and assistant queries
  /\b(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|help|who\s*are\s*you|what\s*can\s*you\s*do|how\s*to\s*use|thank\s*you|thanks)\b/i,
];

/**
 * Validates user prompt for SQL injection, prompt injection, and domain relevance.
 *
 * @param {string} input - Raw user input string.
 * @returns {{ isValid: boolean, reason?: string, message?: string }}
 */
export function validateUserInput(input) {
  const text = String(input || '').trim();

  if (!text) {
    return {
      isValid: false,
      reason: 'empty',
      message: 'Please enter a valid message or question.',
    };
  }

  // 1. Check for SQL Injection
  for (const pattern of SQLI_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        reason: 'sql_injection',
        message:
          '🛡️ Security Warning: Potential SQL injection pattern detected. The query was safely blocked.',
      };
    }
  }

  // 2. Check for Prompt Injection / Jailbreak / Script Injection
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        isValid: false,
        reason: 'prompt_injection',
        message:
          '🛡️ Security Warning: Disallowed prompt injection or system override detected. The query was safely blocked.',
      };
    }
  }

  // 3. Check for Domain Relevance
  const isRelevant = GIS_DOMAIN_PATTERNS.some((pattern) => pattern.test(text));
  if (!isRelevant) {
    return {
      isValid: false,
      reason: 'unrelated_query',
      message:
        'I am Abso, a specialized Urban GIS & Accessibility Analyst for Sime Darby Property. I can only assist with spatial analysis, reachability isochrones, amenities density, transit hubs, site comparisons, and journey sustainability. Please submit a query related to spatial or accessibility analysis.',
    };
  }

  return { isValid: true };
}

/**
 * Helper to check if input is purely a standard conversational greeting or help query.
 */
export function isPureGreeting(prompt) {
  const text = String(prompt || '').trim().toLowerCase();
  const clean = text.replace(/[^a-z0-9\s]/g, '').trim();
  const greetingPhrases = [
    'hi',
    'hello',
    'hey',
    'hey there',
    'hello there',
    'hi there',
    'good morning',
    'good afternoon',
    'good evening',
    'help',
    'who are you',
    'what can you do',
    'how can you help',
    'how do i use this',
    'thank you',
    'thanks',
  ];
  return greetingPhrases.includes(clean);
}

/**
 * Detects whether the user query is asking to perform or view an accessibility analysis on the map,
 * and extracts parameters (travel mode, minutes, and target location).
 *
 * @param {string} prompt - Validated user prompt.
 * @param {Object} currentContext - Current app context (travelMode, travelMinutes, locationName, etc.).
 * @returns {{ isAccessibilityIntent: boolean, params: { mode: string, minutes: number, locationQuery: string|null, matchedPreset: Object|null } }}
 */
export function detectAccessibilityIntent(prompt, currentContext = {}) {
  const lower = String(prompt || '').toLowerCase().trim();

  // Pure greetings don't trigger map execution
  if (isPureGreeting(lower)) {
    return {
      isAccessibilityIntent: false,
      params: null,
    };
  }

  // 1. Detect Mode
  let mode = currentContext.travelMode || 'walking';
  if (/\b(bike|biking|bicycle|cycling|cycle)\b/i.test(lower)) {
    mode = 'cycling';
  } else if (/\b(drive|driving|car|vehicle|motor|road|highway)\b/i.test(lower)) {
    mode = 'driving';
  } else if (/\b(walk|walking|walkable|pedestrian|foot|sidewalk|step)\b/i.test(lower)) {
    mode = 'walking';
  }

  // 2. Detect Minutes (10, 20, 30 bracket)
  let minutes = currentContext.travelMinutes || 20;
  if (/\b15\s*(-|\s*)?min(ute)?s?\b/i.test(lower) || /\bfifteen\b/i.test(lower)) {
    minutes = 20;
  } else if (/\b10\s*(-|\s*)?min(ute)?s?\b/i.test(lower) || /\bten\b/i.test(lower)) {
    minutes = 10;
  } else if (/\b20\s*(-|\s*)?min(ute)?s?\b/i.test(lower) || /\btwenty\b/i.test(lower)) {
    minutes = 20;
  } else if (/\b30\s*(-|\s*)?min(ute)?s?\b/i.test(lower) || /\bthirty\b/i.test(lower)) {
    minutes = 30;
  } else {
    const minuteMatch = lower.match(/\b(\d+)\s*(-|\s*)?(min|minute|minutes)\b/i);
    if (minuteMatch && minuteMatch[1]) {
      const rawVal = parseInt(minuteMatch[1], 10);
      if (rawVal <= 12) minutes = 10;
      else if (rawVal <= 25) minutes = 20;
      else minutes = 30;
    }
  }

  // 3. Detect Target Location if specified in query
  let locationQuery = null;
  let matchedPreset = null;

  // Check against known presets first (case-insensitive substring)
  for (const preset of PRESET_LOCATIONS) {
    const pName = preset.name.toLowerCase();
    const keywords = [
      pName,
      preset.id.replace(/-/g, ' '),
      ...(pName.includes('klcc') ? ['klcc', 'petronas', 'suria'] : []),
      ...(pName.includes('trx') ? ['trx', 'the exchange'] : []),
      ...(pName.includes('mid valley') ? ['mid valley', 'midvalley'] : []),
      ...(pName.includes('kl sentral') ? ['kl sentral', 'sentral'] : []),
      ...(pName.includes('pavilion') ? ['pavilion'] : []),
      ...(pName.includes('bangsar') ? ['bangsar', 'bangsar village'] : []),
      ...(pName.includes('bukit bintang') ? ['bukit bintang'] : []),
      ...(pName.includes('sime darby') ? ['sime darby', 'sime darby centre'] : []),
    ];

    if (keywords.some((k) => lower.includes(k))) {
      matchedPreset = preset;
      locationQuery = preset.name;
      break;
    }
  }

  // If no preset matched, try extracting location after "at", "around", "for", "in", "near", "of"
  if (!matchedPreset) {
    const locPattern = /\b(?:around|at|for|near|in|on|of)\s+([A-Za-z0-9\s,.-]+?)(?:\s+(?:for|within|with|under|in|and|\d+\s*min)|$|\?|\.|\!)/i;
    const match = lower.match(locPattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const forbidden = [
        'walking', 'cycling', 'driving', 'walk', 'bike', 'drive',
        '10 min', '20 min', '30 min', '15 min', 'current location',
        'this location', 'this area', 'here', 'the area', 'the map',
        'a 15-minute walk', 'a 20-minute walk', 'a 10-minute walk',
      ];
      if (candidate && !forbidden.includes(candidate.toLowerCase())) {
        locationQuery = candidate;
      }
    }
  }

  return {
    isAccessibilityIntent: true,
    params: {
      mode,
      minutes,
      locationQuery,
      matchedPreset,
    },
  };
}
