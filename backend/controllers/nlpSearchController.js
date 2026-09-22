const axios = require('axios');
const { sendSuccess, sendError } = require('../utils/responseUtils');

// ─── Grok API Config (via Groq — OpenAI-compatible endpoint) ─────────────────
const GROK_API_KEY = process.env.GROQ_API_KEY;
const GROK_MODEL = 'llama-3.3-70b-versatile';
const GROK_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROK_TIMEOUT_MS = 15000; // Groq is much faster than HuggingFace warm-up

// ─── Static domain lists (must match frontend + backend filter values) ────────
const SPORT_TYPES = [
  'Tennis', 'Football', 'Basketball', 'Badminton', 'Volleyball',
  'Table Tennis', 'Cricket', 'Hockey', 'Swimming', 'Gym/Fitness',
  'Padel', 'Futsal', 'Indoor Cricket',
];

const AMENITIES_LIST = [
  'Parking', 'Changing Rooms', 'Showers', 'Equipment Rental',
  'Lighting', 'Air Conditioning', 'Wi-Fi', 'Cafeteria',
  'First Aid', 'CCTV Security', 'Lockers', 'Water Fountain',
];

// Intent labels sent to Grok for zero-shot classification
const INTENT_LABELS = [
  'search sports venues',
  'find nearby courts',
  'check availability',
  'list sports types',
  'filter by sport',
  'filter by price',
  'filter by location',
  'filter by amenity',
  'navigate to page',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract structured entities from a raw query using regex + keyword matching.
 * This runs regardless of whether Grok succeeds (supplements AI intent).
 */
const extractEntities = (rawQuery) => {
  const q = rawQuery.toLowerCase();

  // --- Sport ---
  let sport = null;
  for (const s of SPORT_TYPES) {
    if (q.includes(s.toLowerCase())) {
      sport = s;
      break;
    }
  }

  // --- Amenities ---
  const amenities = AMENITIES_LIST.filter((a) => q.includes(a.toLowerCase()));

  // --- Availability ---
  let availability = null;
  if (/\bnow\b/.test(q) || /right now/.test(q)) availability = 'now';
  else if (/\btoday\b/.test(q)) availability = 'today';
  else if (/\btomorrow\b/.test(q)) availability = 'tomorrow';
  else if (/\bweekend\b/.test(q) || /\bthis weekend\b/.test(q)) availability = 'weekend';

  // --- Price ---
  let minPrice = null;
  let maxPrice = null;
  let sortBy = null;

  // "under 2000", "below 1500", "max 3000", "less than 2000"
  const maxPriceMatch = q.match(/(?:under|below|max|less than|upto|up to)\s*(?:rs\.?|pkr\.?)?\s*(\d[\d,]*)/i);
  if (maxPriceMatch) {
    maxPrice = parseInt(maxPriceMatch[1].replace(/,/g, ''), 10);
  }

  // "over 500", "above 1000", "at least 800", "minimum 500"
  const minPriceMatch = q.match(/(?:over|above|at least|minimum|min)\s*(?:rs\.?|pkr\.?)?\s*(\d[\d,]*)/i);
  if (minPriceMatch) {
    minPrice = parseInt(minPriceMatch[1].replace(/,/g, ''), 10);
  }

  // standalone Rs/PKR amount e.g. "Rs 2000 courts"
  if (!maxPrice && !minPrice) {
    const priceMatch = q.match(/(?:rs\.?|pkr\.?)\s*(\d[\d,]+)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1].replace(/,/g, ''), 10);
    }
  }

  // Sort direction keywords
  if (/\bcheap\b|\blowest price\b|\baffordable\b|\bbudget\b/.test(q)) {
    sortBy = 'price-asc';
  } else if (/\bexpensive\b|\bhighest price\b|\bpremium\b/.test(q)) {
    sortBy = 'price-desc';
  } else if (/\bbest rated\b|\btop rated\b|\bhighest rated\b|\bbest\b/.test(q)) {
    sortBy = 'rating-desc';
  }

  // --- Rating ---
  let rating = null;
  const ratingMatch = q.match(/(\d(?:\.\d)?)\+?\s*star/i);
  if (ratingMatch) {
    rating = `${parseFloat(ratingMatch[1]).toFixed(1)}+`;
  } else if (/\bhighly rated\b|\bbest rated\b|\btop rated\b/.test(q)) {
    rating = '4.0+';
  }

  // --- Location ---
  // Extract text after "in ", "at ", "near ", "around "
  let location = null;
  const locationMatch = q.match(/(?:in|at|near|around)\s+([a-z][a-z\s\-]{1,40}?)(?:\s+with|\s+for|\s+that|\s*$)/i);
  if (locationMatch) {
    const candidate = locationMatch[1].trim();
    // Filter out sport/amenity false positives
    const isSport = SPORT_TYPES.some((s) => s.toLowerCase() === candidate.toLowerCase());
    if (!isSport) {
      location = candidate
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  // --- Cleaned search query (for text search in backend) ---
  const stopWords = [
    'find', 'show', 'get', 'search', 'me', 'a', 'an', 'the', 'courts',
    'court', 'venue', 'venues', 'cheap', 'best', 'good', 'near', 'available',
    'affordable', 'budget', 'premium', 'some', 'any', 'please', 'now', 'today',
    'with', 'and', 'or', 'for', 'this', 'that', 'are', 'is', 'in', 'at',
    'around', 'about', 'have', 'has', 'on', 'of',
  ];
  const cleaned = rawQuery
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => !stopWords.includes(w) && w.length > 1)
    .join(' ')
    .trim();

  // Build a rich search query: combine sport + location + raw terms
  const queryParts = [];
  if (sport) queryParts.push(sport.toLowerCase());
  if (location) queryParts.push(location.toLowerCase());
  if (cleaned) queryParts.push(cleaned);
  const richQuery = [...new Set(queryParts.join(' ').split(/\s+/))].join(' ');

  return {
    sport,
    location,          // kept for display in the banner
    amenities: amenities.length ? amenities : null,
    availability,
    minPrice,
    maxPrice,
    sortBy,
    rating,
    query: richQuery || rawQuery.trim(),
  };
};

/**
 * Map Grok/AI top label → internal intent string
 */
const mapAILabelToIntent = (topLabel) => {
  const l = topLabel.toLowerCase();
  if (l.includes('nearby')) return 'find_nearby';
  if (l.includes('availability')) return 'check_availability';
  if (l.includes('list sports')) return 'list_sports';
  if (l.includes('navigate')) return 'navigate';
  return 'search_venues'; // default for all filter/search intents
};

// ─── Grok API Call ────────────────────────────────────────────────────────────

/**
 * Classify the user's search intent using Grok (Groq llama-3.3-70b-versatile).
 * Returns { intent: string, confidence: number }
 */
const callGrokAPI = async (query) => {
  if (!GROK_API_KEY) {
    throw new Error('GROQ_API_KEY not set in environment');
  }

  console.log('[NLP_SEARCH] Calling Grok API — model:', GROK_MODEL);

  const systemPrompt = `You are a sports venue search intent classifier for a Pakistani sports court booking app.
Given a user search query, return ONLY a valid JSON object (no markdown fences, no explanation, no extra text).
Choose the single best intent from this list: ${INTENT_LABELS.join(', ')}.
Format your response exactly as: {"intent": "<chosen_intent>", "confidence": <float between 0.0 and 1.0>}`;

  const response = await axios.post(
    GROK_API_URL,
    {
      model: GROK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      temperature: 0,
      max_tokens: 80,
    },
    {
      headers: {
        Authorization: `Bearer ${GROK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: GROK_TIMEOUT_MS,
    }
  );

  const raw = response.data.choices?.[0]?.message?.content?.trim() || '';

  // Extract JSON from response (strip possible markdown fences just in case)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Grok response did not contain valid JSON. Raw: "${raw.slice(0, 120)}"`);
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    intent: parsed.intent || 'search venues',
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.85,
  };
};

// ─── Main Controller ──────────────────────────────────────────────────────────

exports.nlpSearch = async (req, res) => {
  const startedAt = Date.now();

  const { query } = req.body;

  // Validate
  if (!query || typeof query !== 'string' || !query.trim()) {
    return sendError(res, 400, 'Query must be a non-empty string');
  }

  const trimmedQuery = query.trim().slice(0, 500); // safety cap

  console.log(`[NLP_SEARCH_REQUEST] query="${trimmedQuery.slice(0, 80)}" len=${trimmedQuery.length}`);

  // Always extract entities locally — fast, no external dependency
  const entities = extractEntities(trimmedQuery);

  let intent = 'search_venues';
  let confidence = 0;
  let usedMethod = 'fallback_regex'; // will be updated if Grok succeeds

  // ── Try Grok API ─────────────────────────────────────────────────────────
  try {
    const grokData = await callGrokAPI(trimmedQuery);

    if (grokData && grokData.intent) {
      intent = mapAILabelToIntent(grokData.intent);
      confidence = Math.round((grokData.confidence || 0.9) * 100) / 100;
      usedMethod = 'grok_api';

      console.log(
        `[NLP_SEARCH_GROK_SUCCESS] intent="${intent}" grokLabel="${grokData.intent}" confidence=${confidence} latencyMs=${Date.now() - startedAt}`
      );
    }
  } catch (grokError) {
    // Log the failure clearly so we know it fell back
    const isTimeout = grokError.code === 'ECONNABORTED' || grokError.code === 'ETIMEDOUT';
    const httpStatus = grokError?.response?.status;

    console.warn(
      `[NLP_SEARCH_GROK_FALLBACK] Grok API failed — using regex fallback.`,
      `reason=${isTimeout ? 'TIMEOUT' : `HTTP_${httpStatus || 'UNKNOWN'}`}`,
      `msg="${grokError.message?.slice(0, 80)}"`
    );

    // intent and confidence stay at defaults from regex path
    intent = 'search_venues';
    confidence = 0.5; // moderate confidence for regex-only
    usedMethod = 'fallback_regex';
  }

  const latencyMs = Date.now() - startedAt;

  console.log(
    `[NLP_SEARCH_COMPLETE] method=${usedMethod} intent=${intent} latencyMs=${latencyMs}`,
    `entities=${JSON.stringify(entities)}`
  );

  return sendSuccess(res, 200, 'NLP search intent extracted successfully', {
    intent,
    confidence,
    entities,
    rawQuery: trimmedQuery,
    usedMethod,   // "grok_api" or "fallback_regex" — visible to frontend
    latencyMs,
  });
};
