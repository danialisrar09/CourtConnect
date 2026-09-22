const axios = require('axios');
const { Venue } = require('../models');
const { sendSuccess, sendError } = require('../utils/responseUtils');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const GROK_MODEL = 'llama-3.3-70b-versatile';
const GROK_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROK_COOLDOWN_MS = Number(process.env.GEMINI_COOLDOWN_MS || 60000);

// Simple process-level cooldown to avoid repeatedly hitting provider quota after 429.
let grokBackoffUntil = 0;

const normalizePage = (pagePath = '') => {
    const p = String(pagePath || '').toLowerCase();
    if (p.includes('/find-court')) return 'find-court';
    if (p.includes('/dashboard/customer')) return 'customer-dashboard';
    if (p.includes('/dashboard/business')) return 'business-dashboard';
    if (p.includes('/checkout')) return 'checkout';
    if (p.includes('/cart')) return 'cart';
    return 'general';
};

const buildContextualActions = ({ page }) => {
    switch (page) {
        case 'find-court':
            return [
                { label: 'Open Find Court', path: '/find-court' },
                { label: 'Open Cart', path: '/cart' },
            ];
        case 'customer-dashboard':
            return [
                { label: 'Open My Dashboard', path: '/dashboard/customer' },
                { label: 'Find Courts', path: '/find-court' },
                { label: 'Open Cart', path: '/cart' },
            ];
        case 'business-dashboard':
            return [
                { label: 'Open Business Dashboard', path: '/dashboard/business' },
                { label: 'Find Courts View', path: '/find-court' },
            ];
        case 'checkout':
            return [
                { label: 'Open Checkout', path: '/checkout' },
                { label: 'Open Cart', path: '/cart' },
            ];
        default:
            return [
                { label: 'Find Courts', path: '/find-court' },
                { label: 'Open Dashboard', path: '/dashboard/customer' },
            ];
    }
};

const buildContextualSuggestions = ({ page, message }) => {
    const msg = String(message || '').toLowerCase();
    if (msg.includes('deposit') || msg.includes('payment')) {
        return [
            'How does 50% deposit work?',
            'Why is payment still pending?',
            'Show booking payment steps',
        ];
    }

    if (page === 'find-court') {
        return [
            'Show available courts',
            'How to use nearby courts?',
            'How to get directions?',
        ];
    }

    if (page === 'business-dashboard') {
        return [
            'How do I manage bookings?',
            'How do I update venue details?',
            'How do customer deposits work?',
        ];
    }

    return [
        'Show available courts',
        'Explain booking steps',
        'How does 50% deposit work?',
    ];
};

const isUnsupportedDirectActionRequest = (message) => {
    const msg = String(message || '').toLowerCase();
    const asksBotToDoIt = /(for me|yourself|do it|right now|immediately)/.test(msg);
    const mutatingIntent = /(mark|set|change|update|cancel|refund|delete|complete|confirm).*(booking|payment|status)/.test(msg);
    const secretIntent = /(api key|token|secret|password|database url|env)/.test(msg);
    return (asksBotToDoIt && mutatingIntent) || secretIntent;
};

const getLocalSupportReply = ({ message, page }) => {
    const msg = String(message || '').toLowerCase().trim();

    if (!msg) return null;

    if (/^(hi|hello|hey|salam|assalam)/.test(msg)) {
        return 'Hi! I can help you with finding courts, booking steps, deposit/payment guidance, and account help. What would you like to do first?';
    }

    if (/available court|show.*court|find.*court|nearby/.test(msg)) {
        return 'Open Find Court, apply sport/location filters, then choose a slot and continue to cart. Use Nearby Courts if your location is enabled.';
    }

    if (/booking step|how.*book|book.*court|checkout/.test(msg)) {
        return 'Booking flow is: Find Court -> select slot -> Add to Cart -> Checkout -> owner confirms -> customer pays 50% deposit.';
    }

    if (/50%|deposit|advance payment|payment.*work/.test(msg)) {
        return 'After owner confirmation, customer pays a 50% deposit. Payment status updates through verified payment flow, then booking continues as confirmed.';
    }

    if (/payment.*pending|why.*pending/.test(msg)) {
        return 'If payment is pending, wait a few seconds and refresh dashboard. If still pending, open booking details and retry payment from the provided action.';
    }

    if (page === 'business-dashboard' && /manage|booking|customer/.test(msg)) {
        return 'On Business Dashboard, use Bookings tab to review customer bookings and actions, and use My Listings to manage venue details and calendar.';
    }

    return null;
};

const buildSystemPrompt = ({ role, page, location }) => {
    return [
        'You are CourtConnect Assistant for a sports court booking app.',
        'Tone: short, polite, helpful, app-focused.',
        'Main topics: court search help, booking steps, payment/deposit help, account/help FAQ.',
        'Safety boundaries: do not claim to update booking/payment status directly; guide users to the correct page/action.',
        'Grounded booking/payment rules: booking starts pending and must be confirmed by owner; deposit payment is 50% and payment status changes only via verified payment flow.',
        'Never reveal secrets, API keys, tokens, or private/internal data.',
        `User role: ${role || 'customer'}.`,
        `Current page: ${page || 'unknown'}.`,
        `User location context: ${location || 'not provided'}.`,
        'If user asks for unsupported action, politely refuse and provide next best in-app step.',
        'When useful, end with a clear next action in one short line.'
    ].join('\n');
};

const parseGrokText = (data) => {
    return data?.choices?.[0]?.message?.content?.trim() || '';
};

const isRetryableGrokError = (error) => {
    const status = error?.response?.status;
    return status === 429 || (status >= 500 && status < 600) || error?.code === 'ECONNABORTED';
};

const callGrokWithRetry = async ({ apiKey, prompt, message, model }) => {
    const payload = {
        model,
        messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: message }
        ],
        temperature: 0.4,
        max_tokens: 320,
    };

    const maxAttempts = 2;
    let lastError;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
            return await axios.post(GROK_API_URL, payload, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                timeout: 12000
            });
        } catch (error) {
            lastError = error;
            if (!isRetryableGrokError(error) || attempt === maxAttempts) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, 700));
        }
    }
    throw lastError;
};

exports.chatWithGemini = async (req, res) => {
    const startedAt = Date.now();
    let role = req.user?.currentRole || req.user?.profileType || 'customer';
    let page = normalizePage(req.body?.context?.page || 'unknown');
    let actions = buildContextualActions({ page, role });
    let suggestions = buildContextualSuggestions({ page, message: req.body?.message || '' });
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            return sendError(res, 500, 'Groq API key is not configured in backend environment');
        }

        const { message, sessionId, context = {} } = req.body;
        role = context.role || req.user?.currentRole || req.user?.profileType || 'customer';
        page = normalizePage(context.page || 'unknown');
        const location = context.location || '';
        actions = buildContextualActions({ page, role });
        suggestions = buildContextualSuggestions({ page, message });

        // Safe logs: record metadata only, never full user prompt.
        console.log(
            `[AI_CHAT_REQUEST] user=${req.user?._id} role=${role} page=${page} msgLen=${String(message || '').length} session=${sessionId ? String(sessionId).slice(0, 18) : 'none'}`
        );

        if (isUnsupportedDirectActionRequest(message)) {
            const reply = 'I cannot perform direct account or payment changes. I can guide you to the correct page and steps to do it safely.';
            return sendSuccess(res, 200, 'Chat response generated successfully', {
                reply,
                suggestions,
                actions,
                model: GROK_MODEL,
                latencyMs: Date.now() - startedAt,
            });
        }

        // Serve common app-support intents locally to reduce quota pressure and keep responses fast.
        const localReply = getLocalSupportReply({ message, page });
        if (localReply) {
            return sendSuccess(res, 200, 'Chat response generated successfully', {
                reply: localReply,
                suggestions,
                actions,
                model: 'local-support',
                latencyMs: Date.now() - startedAt,
            });
        }

        if (Date.now() < grokBackoffUntil) {
            const cooldownSecs = Math.max(1, Math.ceil((grokBackoffUntil - Date.now()) / 1000));
            return sendSuccess(res, 200, 'Chat response generated with cooldown fallback', {
                reply: `I am receiving high traffic right now. Please retry in about ${cooldownSecs} seconds. You can continue using the app actions below.`,
                suggestions,
                actions,
                model: 'fallback-cooldown',
                latencyMs: Date.now() - startedAt,
            });
        }

        const systemPrompt = buildSystemPrompt({ role, page, location });
        const grokResponse = await callGrokWithRetry({
            apiKey,
            prompt: systemPrompt,
            message,
            model: GROK_MODEL,
        });

        const reply = parseGrokText(grokResponse.data);
        if (!reply) {
            return sendError(res, 502, 'Groq returned an empty response');
        }

        const latencyMs = Date.now() - startedAt;
        console.log(`[AI_CHAT_SUCCESS] user=${req.user?._id} model=${GROK_MODEL} latencyMs=${latencyMs} replyLen=${reply.length}`);

        return sendSuccess(res, 200, 'Chat response generated successfully', {
            reply,
            suggestions,
            actions,
            model: GROK_MODEL,
            latencyMs,
        });
    } catch (error) {
        const status = error?.response?.status;
        const latencyMs = Date.now() - startedAt;
        if (status === 429) {
            grokBackoffUntil = Date.now() + GROK_COOLDOWN_MS;
            console.warn(`[AI_CHAT_RATE_LIMIT] status=429 latencyMs=${latencyMs} cooldownMs=${GROK_COOLDOWN_MS}`);
        } else {
            console.error(`[AI_CHAT_ERROR] status=${status || 'n/a'} latencyMs=${latencyMs} message=${error.message}`);
        }

        // Graceful degradation for provider throttling/outage.
        if (status === 429 || (status >= 500 && status < 600) || error?.code === 'ECONNABORTED') {
            const localFallback = getLocalSupportReply({ message: req.body?.message, page });
            return sendSuccess(res, 200, 'Chat response generated with fallback', {
                reply: localFallback || 'I am receiving high traffic right now. Please retry in a moment. You can still continue using the suggested app actions below.',
                suggestions,
                actions,
                model: 'fallback',
                latencyMs,
            });
        }

        return sendError(res, 502, 'Chat service is temporarily unavailable. Please try again.');
    }
};

exports.getRecommendations = async (req, res) => {
    try {
        const { location, sport, minPrice, maxPrice, amenities, gym, pool, n } = req.query;

        // Build price parameter
        let priceParam = '';
        if (minPrice || maxPrice) {
            priceParam = `${minPrice || 0}-${maxPrice || 10000}`;
        }

        // Prepare params for Python API
        const params = {
            location: location || '',
            sport: sport || '',
            price: priceParam,
            gym: gym || '',
            pool: pool || '',
            n: parseInt(n) || 12
        };

        console.log('[AI Controller] Calling FastAPI with params:', params);

        // Call Python FastAPI
        const response = await axios.get(`${FASTAPI_URL}/api/recommend`, {
            params,
            timeout: 10000 // 10 second timeout
        });

        console.log(`[AI Controller] Success! Got ${response.data.count} recommendations`);

        // Enrich recommendations with actual MongoDB venue IDs
        const enrichedRecommendations = await Promise.all(
            (response.data.recommendations || []).map(async (rec) => {
                try {
                    // Extract venue information from AI recommendation
                    const facilityName = rec.name || rec.facilityName || '';
                    const areaLocation = rec.location || rec.areaLocation || '';
                    const sportsOffered = rec.sport || rec.sportsOffered || '';

                    // Try to find matching venue in MongoDB
                    // Match by name (title) and location, with sport if available
                    const searchQuery = {
                        status: 'active'
                    };

                    // Match by name (case-insensitive, partial match)
                    if (facilityName) {
                        // Clean the name for better matching (remove extra spaces, special chars)
                        const cleanName = facilityName.trim().replace(/\s+/g, ' ');
                        searchQuery.title = { 
                            $regex: cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 
                            $options: 'i' 
                        };
                    }

                    // Match by location if provided (case-insensitive, partial match)
                    if (areaLocation) {
                        // Extract just the area name (before comma if present)
                        const areaName = areaLocation.split(',')[0].trim();
                        searchQuery.location = { 
                            $regex: areaName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 
                            $options: 'i' 
                        };
                    }

                    // Match by sport if provided (exact match, case-insensitive)
                    if (sportsOffered) {
                        // Handle multiple sports (comma-separated) - match if any sport matches
                        const sportsList = sportsOffered.split(',').map(s => s.trim());
                        searchQuery.sport = { $in: sportsList };
                    }

                    // Find the best matching venue
                    const matchingVenue = await Venue.findOne(searchQuery)
                        .select('_id title location sport hourlyPrice images rating ratingCount amenities availability')
                        .lean();

                    if (matchingVenue) {
                        console.log(`[AI Controller] Matched "${facilityName}" to MongoDB venue: ${matchingVenue._id}`);
                        
                        // Return enriched recommendation with MongoDB _id
                        return {
                            ...rec,
                            _id: matchingVenue._id.toString(), // MongoDB ObjectId as string
                            // Update with actual venue data from MongoDB
                            name: matchingVenue.title || rec.name,
                            location: matchingVenue.location || rec.location,
                            sport: matchingVenue.sport || rec.sport,
                            hourlyPrice: matchingVenue.hourlyPrice || rec.price || rec.hourlyPrice || 0,
                            price: matchingVenue.hourlyPrice || rec.price || rec.hourlyPrice || 0,
                            images: matchingVenue.images && matchingVenue.images.length > 0 
                                ? matchingVenue.images 
                                : (rec.image ? [rec.image] : []),
                            image: matchingVenue.images && matchingVenue.images.length > 0 
                                ? matchingVenue.images[0] 
                                : (rec.image || ''),
                            rating: matchingVenue.rating || rec.rating || 0,
                            reviewCount: matchingVenue.ratingCount || rec.reviewCount || 0,
                            amenities: matchingVenue.amenities && matchingVenue.amenities.length > 0
                                ? matchingVenue.amenities
                                : (rec.amenities || []),
                        };
                    } else {
                        console.log(`[AI Controller] No MongoDB match found for "${facilityName}" in "${areaLocation}"`);
                        // If no match found, return original recommendation (frontend will use search fallback)
                        return rec;
                    }
                } catch (matchError) {
                    console.error(`[AI Controller] Error matching recommendation "${rec.name}":`, matchError.message);
                    // Return original recommendation on error
                    return rec;
                }
            })
        );

        // Return enriched recommendations
        res.status(200).json({
            ...response.data,
            recommendations: enrichedRecommendations
        });

    } catch (error) {
        console.error('[AI Controller] Error calling FastAPI:', error.message);

        res.status(500).json({
            success: false,
            message: 'Failed to get AI recommendations',
            error: error.message,
            recommendations: []
        });
    }
};
