import api from './api';

export interface AIRecommendationParams {
  location?: string;
  sport?: string;
  minPrice?: number;
  maxPrice?: number;
  amenities?: string;
  gym?: string;
  pool?: string;
  n?: number;
}

export interface AIRecommendation {
  _id: string;
  name: string;
  sport: string;
  location?: string;
  address?: string;
  rating: number;
  reviewCount: number;
  hourlyPrice: number;
  image?: string;
  images?: string[];
  amenities: string[];
  matchScore: number;
  status: string;
  description?: string;
  openHours?: string;
  availabilityText?: string;
}

export interface AIRecommendationResponse {
  success: boolean;
  modelUsed: string;
  filterCount: number;
  count: number;
  total: number;
  recommendations: AIRecommendation[];
}

export interface ChatContext {
  page?: string;
  role?: 'customer' | 'business' | 'both';
  location?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  context?: ChatContext;
}

export interface ChatResponse {
  success: boolean;
  message: string;
  data?: {
    reply: string;
    suggestions?: string[];
    actions?: Array<{ label: string; path: string }>;
    model?: string;
    latencyMs?: number;
  };
}

// ─── NLP Search Types ────────────────────────────────────────────────────────

export interface NLPSearchEntities {
  sport: string | null;
  location: string | null;
  amenities: string[] | null;
  availability: 'now' | 'today' | 'tomorrow' | 'weekend' | null;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: 'price-asc' | 'price-desc' | 'rating-desc' | null;
  rating: string | null;
  query: string;
}

export interface NLPSearchResult {
  intent: 'search_venues' | 'find_nearby' | 'check_availability' | 'list_sports' | 'navigate';
  confidence: number;
  entities: NLPSearchEntities;
  rawQuery: string;
  /** "grok_api" when Grok was used, "fallback_regex" when it fell back */
  usedMethod: 'grok_api' | 'fallback_regex';
  latencyMs: number;
}

export interface NLPSearchResponse {
  success: boolean;
  message: string;
  data?: NLPSearchResult;
}

const aiService = {
  /**
   * Get AI-powered venue recommendations
   */
  getRecommendations: async (params: AIRecommendationParams = {}): Promise<AIRecommendationResponse> => {
    const queryParams = new URLSearchParams();
    
    if (params.location) queryParams.append('location', params.location);
    if (params.sport) queryParams.append('sport', params.sport);
    if (params.minPrice) queryParams.append('minPrice', params.minPrice.toString());
    if (params.maxPrice) queryParams.append('maxPrice', params.maxPrice.toString());
    if (params.amenities) queryParams.append('amenities', params.amenities);
    if (params.gym) queryParams.append('gym', params.gym);
    if (params.pool) queryParams.append('pool', params.pool);
    if (params.n) queryParams.append('n', params.n.toString());

    const response = await api.get(`/ai/recommend?${queryParams.toString()}`);
    return response.data;
  },

  /**
   * Chat with Gemini assistant for app support guidance
   */
  chat: async (payload: ChatRequest): Promise<ChatResponse> => {
    const response = await api.post('/ai/chat', payload);
    return response.data;
  },

  /**
   * Extract structured search intent from a natural-language query.
   *
   * Tries Grok API first (llama-3.3-70b-versatile via Groq); falls back to regex/keyword
   * extraction if the Grok API is unavailable. The `usedMethod` field tells you
   * which path was taken: "grok_api" or "fallback_regex".
   */
  nlpSearch: async (query: string): Promise<NLPSearchResult> => {
    const response = await api.post<NLPSearchResponse>('/ai/nlp-search', { query });
    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.message || 'NLP search failed');
    }
    return response.data.data;
  },
};

export default aiService;
