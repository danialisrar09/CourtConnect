import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  Search,
  Filter,
  Users,
  Wifi,
  Car,
  Coffee,
  Zap,
  Heart,
  ChevronLeft, ChevronRight,
  Brain,
  Sparkles,
  X,
  Loader2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { VenueCard } from "../common";
import { MapboxBaseMap } from "../common/MapboxBaseMap";
import { useDebounce, useToggle, useLocalStorage, useRecentSearches, useFavorites } from "../../hooks";
import { usePageTitle } from '../../hooks/usePageTitle';
import { toast } from "sonner";
import venueService from '../../services/venueService';
import aiService, { type NLPSearchResult } from '../../services/aiService';
import { Review } from '../../types';

type MainSearchSuggestion = {
  id: string;
  label: string;
  subLabel?: string;
  kind: 'court' | 'location';
};

export function FindCourtPage() {
  usePageTitle('Find Courts', 'Search and discover sports courts and venues near you. Filter by sport, price, location and amenities.');
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const fromAI = location.state?.fromAI;
  const fromNLP = location.state?.fromNLP;
  const nlpIntent = location.state?.intent;

  // NLP smart search banner state
  const [showNlpBanner, setShowNlpBanner] = useState<boolean>(false);

  // ── Inline NLP Smart Search (same as HomePage) ───────────────────────────
  const [nlpInputQuery, setNlpInputQuery] = useState('');
  const [isNlpLoading, setIsNlpLoading] = useState(false);
  const [nlpError, setNlpError] = useState<string | null>(null);
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [showFilters, toggleFilters] = useToggle(false);
  const [sortByDisplay, setSortByDisplay] = useLocalStorage("courtSortBy", "recommended");
  
  // Map frontend sort values to backend
  const sortBy = sortByDisplay === 'price-low' ? 'price-asc'
    : sortByDisplay === 'price-high' ? 'price-desc'
    : sortByDisplay === 'rating' ? 'rating-desc'
    : sortByDisplay;
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 21;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [recentSearches, addSearch, removeSearch] = useRecentSearches(5);
  const [favorites, addFavorite, removeFavorite, isFavorite, refreshFavorites, favoritesLoading] = useFavorites();
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<MainSearchSuggestion[]>([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [hasCurrentLocation, setHasCurrentLocation] = useState(false);
  const [nearbyModeEnabled, setNearbyModeEnabled] = useState(false);
  const [nearbyCourts, setNearbyCourts] = useState<any[]>([]);
  const [hoveredCourtId, setHoveredCourtId] = useState<string | null>(null);
  const [focusedCourt, setFocusedCourt] = useState<{ id: string; name: string; sport?: string; location?: string; lat: number; lng: number } | null>(null);
  const SPORT_TYPES = [
    'Tennis','Football','Basketball','Badminton','Volleyball',
    'Table Tennis','Cricket','Hockey','Swimming','Gym/Fitness'
  ];
  const AMENITIES = [
    'Parking','Changing Rooms','Showers','Equipment Rental',
    'Lighting','Air Conditioning','Wi-Fi','Cafeteria',
    'First Aid','CCTV Security','Lockers','Water Fountain'
  ];
  
  // Reset persisted filters by changing the storage key to avoid old defaults
  const [filters, setFilters] = useLocalStorage("courtFiltersV2", {
    sport: "",
    priceRange: "",
    location: "",
    amenities: [] as string[],
    rating: "", // default: Any rating (includes new venues with 0 rating)
    availability: "",
  });

  const hasManualFilters = Boolean(
    searchQuery.trim() ||
      filters.sport ||
      filters.priceRange ||
      filters.location ||
      filters.rating ||
      filters.availability ||
      (filters.amenities && filters.amenities.length > 0),
  );

  // ── Single initialisation effect (runs once on mount) ───────────────────────
  // Reads ALL URL params that may have been set by AI Enhanced Search from
  // HomePage, and applies them atomically to the filter state.
  // If no URL params exist, clears any stale values from localStorage.
  useEffect(() => {
    const urlQuery        = searchParams.get('q');
    const urlLocation     = searchParams.get('location');
    const urlSport        = searchParams.get('sport');
    const urlAvailability = searchParams.get('availability');
    const urlMinPrice     = searchParams.get('minPrice');
    const urlMaxPrice     = searchParams.get('maxPrice');
    const urlAmenities    = searchParams.get('amenities');
    const urlSortBy       = searchParams.get('sortBy');
    const urlRating       = searchParams.get('rating');

    const hasAnyParam = urlQuery || urlLocation || urlSport || urlAvailability ||
      urlMinPrice || urlMaxPrice || urlAmenities || urlSortBy || urlRating;

    if (hasAnyParam) {
      // ── Apply AI-Enhanced Search params ─────────────────────────────────────
      if (urlQuery) setSearchQuery(urlQuery);

      // Build priceRange string from separate min/max params
      let priceRange = '';
      if (urlMinPrice || urlMaxPrice) {
        priceRange = `${urlMinPrice ?? ''}-${urlMaxPrice ?? ''}`;
      }

      // Overwrite filters completely so stale localStorage values don't bleed in.
      // IMPORTANT: sport and location are intentionally set to '' here.
      // The NLP controller already folds sport+location into the ?q= rich query
      // (e.g. "football gulshan"), so the backend $or regex handles both.
      // Sending sport as a STRICT filter alongside q= causes 0 results because
      // the query requires: (title starts with "football gulshan") AND sport=Football
      // which can never both be true at the same time.
      setFilters({
        sport:        '',   // intentionally empty — q= carries sport+location
        location:     '',   // intentionally empty — q= carries location
        availability: urlAvailability || '',
        priceRange:   priceRange,
        amenities:    urlAmenities ? urlAmenities.split(',').filter(Boolean) : [],
        rating:       urlRating       || '',
      });

      // Map backend sortBy key → frontend display key
      if (urlSortBy) {
        const sortMap: Record<string, string> = {
          'price-asc':   'price-low',
          'price-desc':  'price-high',
          'rating-desc': 'rating',
        };
        setSortByDisplay(sortMap[urlSortBy] || 'recommended');
      }

      // Show the AI Enhanced banner
      if (fromNLP) setShowNlpBanner(true);

    } else {
      // ── No URL params → fresh page load, clear stale localStorage ───────────
      setFilters({
        sport:        '',
        priceRange:   '',
        location:     '',
        amenities:    [],
        rating:       '',
        availability: '',
      });
    }

    setCurrentPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only once on mount

  // Keep the search query in sync when URL ?q= changes AFTER mount
  // (e.g. user navigates from /find-court back to /find-court with new params)
  useEffect(() => {
    const urlQuery    = searchParams.get('q');
    const urlLocation = searchParams.get('location');
    if (urlQuery !== null && urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
    if (urlLocation && urlLocation !== filters.location) {
      setFilters(prev => ({ ...prev, location: urlLocation }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Fetch venues from API
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: Record<string, any> = {
          page: currentPage,
          limit: itemsPerPage,
          sortBy: sortBy === 'recommended' ? undefined : sortBy,
          q: debouncedSearchQuery || undefined,
          sport: filters.sport || undefined,
          availability: filters.availability || undefined,
          location: filters.location || undefined,
          // Don't send rating filter to backend — we'll filter client-side using local reviews
          // rating: filters.rating && filters.rating !== 'below-4' ? parseFloat(filters.rating) : undefined,
          // maxRating: filters.rating === 'below-4' ? 4 : undefined,
        };
        // priceRange "min-max" format
        if (filters.priceRange) {
          const [min, max] = filters.priceRange.split('-');
          if (min) params.minPrice = min;
          if (max) params.maxPrice = max;
        }
        if (filters.amenities && filters.amenities.length) {
          params.amenities = filters.amenities.join(',');
        }
        const resp = await venueService.getVenues(params);
        const data = resp?.data || resp; // { items, total, totalPages }
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (e: any) {
        setError(e?.response?.data?.message || 'Failed to load venues');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentPage, itemsPerPage, sortBy, debouncedSearchQuery, filters]);

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const resp = await venueService.getVenueLocations();
        const payload = resp?.data || resp;
        const list = Array.isArray(payload?.locations) ? payload.locations : [];
        const normalized = list
          .map((value: any) => String(value || '').trim())
          .filter(Boolean);
        setLocationOptions(Array.from(new Set(normalized)));
      } catch {
        setLocationOptions([]);
      }
    };

    void loadLocations();
  }, []);

  const amenityIcons = {
    "Air Conditioning": <Zap className="h-4 w-4" />,
    Parking: <Car className="h-4 w-4" />,
    "Equipment Rental": <Users className="h-4 w-4" />,
    "Locker Rooms": <Users className="h-4 w-4" />,
    Floodlights: <Zap className="h-4 w-4" />,
    "Changing Rooms": <Users className="h-4 w-4" />,
    Refreshments: <Coffee className="h-4 w-4" />,
    "Spectator Seating": <Users className="h-4 w-4" />,
    "Indoor Court": <Users className="h-4 w-4" />,
    "Sound System": <Wifi className="h-4 w-4" />,
    "Multiple Courts": <Users className="h-4 w-4" />,
    "Coaching Available": <Users className="h-4 w-4" />,
  };

  // Helper to compute local review stats from localStorage
  const getLocalReviewStats = (venueId: string) => {
    try {
      const store = localStorage.getItem('venueReviews');
      if (!store) return null;
      const reviews = JSON.parse(store)[venueId] as Review[] || [];
      if (reviews.length === 0) return null;
      
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      return { rating: avgRating, count: reviews.length };
    } catch (err) {
      return null;
    }
  };

  /**
   * Generates a deterministic PKR price in the range 1000–5000,
   * in multiples of 500 only. Uses the court name as a stable seed
   * so the same court always shows the same price across renders.
   */
  const getPKRPrice = (dbPrice: number | undefined, courtName: string): number => {
    // If the DB has a realistic PKR price already (>= 500), use it
    if (dbPrice && dbPrice >= 500) return dbPrice;

    // Seed a stable pseudo-random from the court name
    let hash = 0;
    const str = (courtName || 'court').toLowerCase();
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    // Multiples of 500 from 1000 to 5000 → 9 options: 1000,1500,2000,2500,3000,3500,4000,4500,5000
    const steps = 9;
    const step = hash % steps; // 0..8
    return 1000 + step * 500;
  };

  // Server-side filtering and pagination are applied; use `items`
  const displayedCourts = items
    .filter((v: any) => {
      // Client-side rating filter using local review stats
      if (!filters.rating) return true;
      
      const venueId = v.id || v._id;
      const localStats = getLocalReviewStats(venueId);
      const rating = localStats?.rating ?? v.rating ?? 0;
      
      if (filters.rating === 'below-4') {
        return rating < 4;
      } else {
        const minRating = parseFloat(filters.rating);
        return rating >= minRating;
      }
    })
    .map((v: any) => {
      const venueId = v.id || v._id;
      const localStats = getLocalReviewStats(venueId);
      
      return {
        id: venueId,
        name: v.name,
        sport: v.sport,
        location: v.location || v.address || '',
        rating: localStats?.rating ?? v.rating ?? 0,
        reviews: localStats?.count ?? v.reviewCount ?? v.reviews ?? 0,
        price: getPKRPrice(v.hourlyPrice || v.price, v.name || v.title),
        currency: 'PKR',
        availability: v.availabilityText || 'Available',
        image: v.image || v.images?.[0] || '',
        amenities: v.amenities || [],
        distance: v.distance || '',
        openHours: v.openHours || '',
      };
    });

  const mapPriceBounds = (() => {
    if (!filters.priceRange) {
      return { minPrice: undefined as number | undefined, maxPrice: undefined as number | undefined };
    }

    const [rawMin, rawMax] = filters.priceRange.split('-');
    const min = rawMin ? Number(rawMin) : undefined;
    const max = rawMax ? Number(rawMax) : undefined;

    return {
      minPrice: Number.isFinite(min as number) ? min : undefined,
      maxPrice: Number.isFinite(max as number) ? max : undefined,
    };
  })();

  const effectiveLocationOptions = locationOptions.length > 0
    ? locationOptions
    : Array.from(new Set(items.map((item: any) => String(item?.location || '').trim()).filter(Boolean)));

  const mappedNearbyCourts = nearbyCourts.map((venue: any) => ({
    id: String(venue.id || venue._id || ''),
    name: venue.name || 'Court',
    sport: venue.sport || 'Sport',
    location: venue.location || '',
    rating: Number(venue.rating || 0),
    reviews: Number(venue.reviews || 0),
    price: getPKRPrice(Number(venue.price) || Number(venue.hourlyPrice) || 0, venue.name || 'Court'),
    currency: 'PKR',
    availability: 'Available',
    image: venue.image || venue.images?.[0] || '',
    amenities: venue.amenities || [],
    distance: Number.isFinite(Number(venue.distanceKm)) ? `${Number(venue.distanceKm).toFixed(2)} km` : '',
    openHours: '',
  }));

  const activeTotal = nearbyModeEnabled ? mappedNearbyCourts.length : total;
  const activeTotalPages = nearbyModeEnabled
    ? Math.max(1, Math.ceil(mappedNearbyCourts.length / itemsPerPage))
    : totalPages;
  const activeDisplayedCourts = nearbyModeEnabled
    ? mappedNearbyCourts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : displayedCourts;

  // Compute coordinates for the hovered court to drive map marker animation
  const hoveredCourtCoords = useMemo(() => {
    if (!hoveredCourtId) return null;
    const source = nearbyModeEnabled ? nearbyCourts : items;
    const raw = source.find((item: any) => String(item.id || item._id) === hoveredCourtId);
    if (!raw?.coordinates) return null;
    const lat = Number(raw.coordinates.lat);
    const lng = Number(raw.coordinates.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [hoveredCourtId, nearbyModeEnabled, nearbyCourts, items]);

  // Handle court card click → focus that court on the map
  const handleCourtCardClick = (courtId: string) => {
    const source = nearbyModeEnabled ? nearbyCourts : items;
    const raw = source.find((item: any) => String(item.id || item._id) === courtId);
    if (!raw?.coordinates) return;
    const lat = Number(raw.coordinates.lat);
    const lng = Number(raw.coordinates.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setFocusedCourt({ id: courtId, name: raw.name || 'Court', sport: raw.sport, location: raw.location || raw.address, lat, lng });
  };

  useEffect(() => {
    if (debouncedSearchQuery.trim().length < 2) {
      setSearchSuggestions([]);
      setIsSearchingSuggestions(false);
      return;
    }

    let disposed = false;

    const loadSuggestions = async () => {
      try {
        setIsSearchingSuggestions(true);
        const query = debouncedSearchQuery.trim();
        const resp = await venueService.getVenues({
          q: query,
          page: 1,
          limit: 8,
          sport: filters.sport || undefined,
        });

        if (disposed) return;

        const payload = resp?.data || resp;
        const courtItems = Array.isArray(payload?.items) ? payload.items : [];
        const courtSuggestions: MainSearchSuggestion[] = courtItems.map((item: any) => ({
          id: `court-${String(item.id || item._id || item.name || Math.random())}`,
          label: String(item.name || 'Court'),
          subLabel: `${String(item.sport || 'Sport')} • ${String(item.location || 'Karachi')}`,
          kind: 'court',
        }));

        const lower = query.toLowerCase();
        const locationSuggestions: MainSearchSuggestion[] = effectiveLocationOptions
          .filter((loc) => loc.toLowerCase().includes(lower))
          .slice(0, 5)
          .map((loc) => ({
            id: `location-${loc}`,
            label: loc,
            subLabel: 'Location',
            kind: 'location',
          }));

        const merged = [...courtSuggestions, ...locationSuggestions]
          .filter((item, index, arr) => arr.findIndex((s) => s.label.toLowerCase() === item.label.toLowerCase()) === index)
          .slice(0, 10);

        setSearchSuggestions(merged);
      } catch {
        if (!disposed) {
          setSearchSuggestions([]);
        }
      } finally {
        if (!disposed) {
          setIsSearchingSuggestions(false);
        }
      }
    };

    void loadSuggestions();

    return () => {
      disposed = true;
    };
  }, [debouncedSearchQuery, filters.sport, effectiveLocationOptions]);

  // Save search to recent searches when debounced query changes
  useEffect(() => {
    if (debouncedSearchQuery.trim()) {
      addSearch(debouncedSearchQuery);
    }
  }, [debouncedSearchQuery, addSearch]);

  // Reset to first page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchQuery, filters, sortBy]);

  useEffect(() => {
    if (currentPage > activeTotalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, activeTotalPages]);

  const handleCurrentLocationRequested = () => {
    setSearchQuery('');
    setShowSearchSuggestions(false);
    setFilters({
      sport: '',
      priceRange: '',
      location: '',
      amenities: [],
      rating: '',
      availability: '',
    });
    setSortByDisplay('recommended');
    setCurrentPage(1);
    setHasCurrentLocation(false);
  };

  /**
   * Inline NLP Smart Search — runs the AI intent parser and updates current
   * page filters without leaving FindCourtPage.
   */
  const handleNlpSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = nlpInputQuery.trim();
    if (!q) return;

    setIsNlpLoading(true);
    setNlpError(null);

    try {
      const result = await aiService.nlpSearch(q);

      // Apply extracted entities to the current page
      const { entities } = result;

      // Update search query for text search
      if (entities.query) setSearchQuery(entities.query);

      // Build priceRange string
      let priceRange = '';
      if (entities.minPrice != null || entities.maxPrice != null) {
        priceRange = `${entities.minPrice ?? ''}-${entities.maxPrice ?? ''}`;
      }

      setFilters({
        sport: '',        // q= carries sport
        location: '',     // q= carries location
        availability: entities.availability || '',
        priceRange,
        amenities: entities.amenities || [],
        rating: entities.rating || '',
      });

      // Apply sort
      if (entities.sortBy) {
        const sortMap: Record<string, string> = {
          'price-asc': 'price-low',
          'price-desc': 'price-high',
          'rating-desc': 'rating',
        };
        setSortByDisplay(sortMap[entities.sortBy] || 'recommended');
      }

      setCurrentPage(1);
      setShowNlpBanner(true);

      // Update location state so the banner reflects the new NLP result
      window.history.replaceState(
        { fromNLP: true, intent: result },
        '',
        window.location.pathname + window.location.search
      );

      setNlpInputQuery('');
    } catch (err: any) {
      console.warn('[FindCourtPage] NLP search failed, falling back to text search:', err?.message);
      setNlpError('Smart search unavailable — using regular search.');
      if (nlpInputQuery.trim()) setSearchQuery(nlpInputQuery.trim());
    } finally {
      setIsNlpLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSearchSuggestions(false);
    // Search is already handled by debounced query
  };

  const handleSelectMainSuggestion = (suggestion: MainSearchSuggestion) => {
    setSearchQuery(suggestion.label);
    setShowSearchSuggestions(false);
    if (suggestion.kind === 'location') {
      setFilters((prev) => ({ ...prev, location: suggestion.label }));
    }
  };

  const handleFavoriteToggle = async (court: any) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      toast.error('Please login to add favorites');
      navigate('/login');
      return;
    }

    try {
      if (isFavorite(court.id.toString())) {
        await removeFavorite(court.id.toString());
        toast.success(`${court.name} removed from favorites`);
      } else {
        await addFavorite(court.id.toString());
        toast.success(`${court.name} added to favorites`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update favorites');
    }
  };

  const toggleAmenityFilter = (amenity: string) => {
    setFilters((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenity)
        ? prev.amenities.filter((a) => a !== amenity)
        : [...prev.amenities, amenity],
    }));
  };

  // Smart pagination: Generate page numbers to display with ellipsis
  // Shows max 7 page numbers at a time (configurable) with ellipsis for gaps
  const getPaginationPages = (current: number, total: number, maxVisible: number = 7) => {
    if (total <= maxVisible) {
      // Show all pages if total is small enough
      return Array.from({ length: total }, (_, i) => i + 1);
    }

    const pages: (number | 'ellipsis')[] = [];
    const sidePages = Math.floor((maxVisible - 3) / 2); // Pages on each side of current

    // Always show first page
    pages.push(1);

    if (current <= sidePages + 2) {
      // Near the start: [1] [2] [3] [4] [5] ... [last]
      for (let i = 2; i <= Math.min(maxVisible - 1, total - 1); i++) {
        pages.push(i);
      }
      if (total > maxVisible) {
        pages.push('ellipsis');
        pages.push(total);
      }
    } else if (current >= total - sidePages - 1) {
      // Near the end: [1] ... [last-4] [last-3] [last-2] [last-1] [last]
      if (total > maxVisible) {
        pages.push('ellipsis');
      }
      for (let i = Math.max(2, total - maxVisible + 2); i < total; i++) {
        pages.push(i);
      }
      pages.push(total);
    } else {
      // In the middle: [1] ... [current-2] [current-1] [current] [current+1] [current+2] ... [last]
      pages.push('ellipsis');
      for (let i = Math.max(2, current - sidePages); i <= Math.min(total - 1, current + sidePages); i++) {
        pages.push(i);
      }
      pages.push('ellipsis');
      pages.push(total);
    }

    return pages;
  };

  return (
    <div className="min-h-screen bg-white pt-16 relative z-10">
      {/* AI Enhanced Search Banner */}
      <AnimatePresence>
        {showNlpBanner && fromNLP && nlpIntent && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="relative z-50 bg-gradient-to-r from-[#010101] to-[#1a2a0a] border-b border-[#98e209]/30 px-4 py-3"
          >
            <div className="max-w-7xl mx-auto flex items-start gap-3">
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <Brain className="h-4 w-4 text-white" />
                <span className="text-xs font-bold text-white uppercase tracking-wider">AI Enhanced Search</span>
              </div>
              <div className="flex-1 text-sm text-gray-300 flex flex-wrap gap-x-3 gap-y-1 items-center">
                <Sparkles className="h-3 w-3 text-white shrink-0" />
                <span className="text-gray-400">Detected:</span>
                {nlpIntent.entities?.sport && (
                  <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs font-medium border border-white/20">
                    🏅 {nlpIntent.entities.sport}
                  </span>
                )}
                {nlpIntent.entities?.location && (
                  <span className="bg-blue-500/10 text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-500/20">
                    📍 {nlpIntent.entities.location}
                  </span>
                )}
                {nlpIntent.entities?.availability && (
                  <span className="bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded-full text-xs font-medium border border-purple-500/20">
                    🕐 {nlpIntent.entities.availability}
                  </span>
                )}
                {nlpIntent.entities?.maxPrice && (
                  <span className="bg-yellow-500/10 text-yellow-300 px-2 py-0.5 rounded-full text-xs font-medium border border-yellow-500/20">
                    💰 under Rs {nlpIntent.entities.maxPrice}
                  </span>
                )}
                {nlpIntent.entities?.amenities?.length > 0 && (
                  <span className="bg-white/10 text-white px-2 py-0.5 rounded-full text-xs font-medium border border-white/20">
                    ✅ {nlpIntent.entities.amenities.join(', ')}
                  </span>
                )}
                {nlpIntent.entities?.sortBy && (
                  <span className="bg-orange-500/10 text-orange-300 px-2 py-0.5 rounded-full text-xs font-medium border border-orange-500/20">
                    📊 {nlpIntent.entities.sortBy === 'price-asc' ? 'Cheapest first' : nlpIntent.entities.sortBy === 'rating-desc' ? 'Top rated first' : nlpIntent.entities.sortBy}
                  </span>
                )}
                <span className="text-gray-500 text-xs ml-1">
                  via {nlpIntent.usedMethod === 'grok_api' ? '⚡ Grok AI' : '⚡ AI Enhanced (local)'} · {nlpIntent.confidence ? `${Math.round(nlpIntent.confidence * 100)}% confidence` : ''} · {nlpIntent.latencyMs}ms
                </span>
              </div>
              <button
                onClick={() => setShowNlpBanner(false)}
                className="shrink-0 text-gray-500 hover:text-white transition-colors"
                aria-label="Dismiss AI Enhanced Search banner"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Search Header ═════════════════════════════════════════════════════ */}
      <div className="bg-white border-b shadow-sm relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-3">

          {/* Row 1: AI Smart Search */}
          <form onSubmit={handleNlpSearch}>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Brain className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#98e209] pointer-events-none" />
                <input
                  id="findcourt-nlp-search"
                  type="text"
                  value={nlpInputQuery}
                  onChange={(e) => { setNlpInputQuery(e.target.value); setNlpError(null); }}
                  placeholder='Try: "cheap badminton in Gulshan with parking today"'
                  className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#98e209]/60 focus:border-[#98e209] placeholder:text-gray-400 bg-gray-50 hover:bg-white transition-colors"
                  disabled={isNlpLoading}
                />
              </div>
              <button
                type="submit"
                disabled={isNlpLoading || !nlpInputQuery.trim()}
                className="flex items-center gap-1.5 px-5 py-2.5 bg-[#010101] text-[#98e209] rounded-xl text-sm font-semibold hover:bg-[#222] disabled:opacity-50 disabled:cursor-not-allowed transition-all whitespace-nowrap flex-shrink-0"
              >
                {isNlpLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Searching...</span></>
                  : <><Sparkles className="h-4 w-4" /><span>AI Search</span></>
                }
              </button>
            </div>
            {nlpError && (
              <p className="mt-1.5 text-xs text-amber-600">&#9888; {nlpError}</p>
            )}
          </form>

          {/* Row 2: Filter bar */}
          {!showNlpBanner && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Keyword */}
            <form onSubmit={handleSearch} className="relative flex-1 min-w-[160px] max-w-xs z-40">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                id="findcourt-keyword-search"
                type="text"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setShowSearchSuggestions(true); }}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => window.setTimeout(() => setShowSearchSuggestions(false), 120)}
                placeholder="Keyword filter..."
                className="w-full pl-10 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 placeholder:text-gray-400 bg-gray-50 hover:bg-white transition-colors"
              />
              {(showSearchSuggestions && (isSearchingSuggestions || searchSuggestions.length > 0)) && (
                <div
                  className="absolute left-0 top-[calc(100%+6px)] z-50 w-[340px] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl"
                  style={{ maxHeight: '300px' }}
                >
                  {isSearchingSuggestions && <p className="px-3 py-2 text-xs text-gray-400">Searching...</p>}
                  {!isSearchingSuggestions && searchSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); handleSelectMainSuggestion(suggestion); }}
                      className="block w-full border-b border-gray-50 px-4 py-3 text-left hover:bg-lime-50 transition-colors"
                    >
                      <p className="font-semibold text-gray-900 text-sm">{suggestion.label}</p>
                      {suggestion.subLabel && <p className="text-xs text-gray-400 mt-0.5">{suggestion.subLabel}</p>}
                    </button>
                  ))}
                </div>
              )}
            </form>

            {/* Sport */}
            <Select
              value={filters.sport || undefined}
              onValueChange={(value) => setFilters(prev => ({ ...prev, sport: value === '__any__' || prev.sport === value ? '' : value }))}
            >
              <SelectTrigger className="w-[140px] rounded-xl border-gray-200 bg-gray-50 text-sm">
                <SelectValue placeholder="All Sports" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">All Sports</SelectItem>
                {SPORT_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Location */}
            <Select
              value={filters.location || undefined}
              onValueChange={(value) => setFilters(prev => ({ ...prev, location: value === '__any__' || prev.location === value ? '' : value }))}
            >
              <SelectTrigger className="w-[150px] rounded-xl border-gray-200 bg-gray-50 text-sm">
                <SelectValue placeholder="All Areas" />
              </SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                <SelectItem value="__any__">All Areas</SelectItem>
                {effectiveLocationOptions.map((loc) => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
              </SelectContent>
            </Select>

            {/* Filters toggle */}
            <Button
              onClick={toggleFilters}
              variant="outline"
              className="rounded-xl border-gray-200 text-sm gap-1.5 hover:border-[#98e209] hover:text-[#98e209] transition-colors"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              {showFilters && <X className="h-3 w-3" />}
            </Button>
          </div>
          )}

        </div>
      </div>

      {/* Advanced Filters accordion - shown below search bar when toggled */}
      {showFilters && (
        <div className="bg-gray-50 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => setFilters({
                    sport: "",
                    priceRange: "",
                    location: "",
                    amenities: [],
                    rating: "",
                    availability: "",
                  })}
                >
                  Cancel Filters
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Price Range
                  </label>
                  <Select
                    value={filters.priceRange || undefined}
                    onValueChange={(value: string) =>
                      setFilters(prev => ({
                        ...prev,
                        priceRange: value === "__any__" || prev.priceRange === value ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any price</SelectItem>
                      <SelectItem value="0-2000">Under PKR 2,000</SelectItem>
                      <SelectItem value="2000-5000">PKR 2,000 – 5,000</SelectItem>
                      <SelectItem value="5000-10000">PKR 5,000 – 10,000</SelectItem>
                      <SelectItem value="10000-">PKR 10,000+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Rating
                  </label>
                  <Select
                    value={filters.rating || undefined}
                    onValueChange={(value: string) =>
                      setFilters(prev => ({
                        ...prev,
                        rating: value === "__any__" || prev.rating === value ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any rating" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any rating</SelectItem>
                      <SelectItem value="below-4">Below 4.0</SelectItem>
                      <SelectItem value="4.0+">4.0+ stars</SelectItem>
                      <SelectItem value="4.5+">4.5+ stars</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Availability
                  </label>
                  <Select
                    value={filters.availability || undefined}
                    onValueChange={(value: string) =>
                      setFilters(prev => ({
                        ...prev,
                        availability: value === "__any__" || prev.availability === value ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__any__">Any time</SelectItem>
                      <SelectItem value="now">
                        Available now
                      </SelectItem>
                      <SelectItem value="today">
                        Today
                      </SelectItem>
                      <SelectItem value="tomorrow">
                        Tomorrow
                      </SelectItem>
                      <SelectItem value="weekend">
                        This weekend
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium mb-3">
                  Amenities
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {AMENITIES.map((amenity) => (
                    <div
                      key={amenity}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={amenity}
                        checked={filters.amenities.includes(
                          amenity,
                        )}
                        onCheckedChange={() =>
                          toggleAmenityFilter(amenity)
                        }
                      />
                      <label
                        htmlFor={amenity}
                        className="text-sm cursor-pointer"
                      >
                        {amenity}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-[#010101] mb-2">Map View</h2>
          <p className="text-sm text-gray-600 mb-4">Move or zoom the map to load visible courts. Clustered points will expand on click.</p>
          <MapboxBaseMap
            searchQuery={debouncedSearchQuery || undefined}
            sportFilter={filters.sport || undefined}
            locationFilter={filters.location || undefined}
            amenitiesFilter={filters.amenities}
            availabilityFilter={filters.availability || undefined}
            ratingFilter={filters.rating || undefined}
            minPrice={mapPriceBounds.minPrice}
            maxPrice={mapPriceBounds.maxPrice}
            onCurrentLocationRequested={handleCurrentLocationRequested}
            onNearbyResultsChange={({ items, ignoreFilters, locationReady }) => {
              setNearbyCourts(items || []);
              if (locationReady) {
                setHasCurrentLocation(true);
                setNearbyModeEnabled((prev) => prev || ignoreFilters || !hasManualFilters);
              }
            }}
            highlightedCourtCoords={hoveredCourtCoords}
            focusedCourt={focusedCourt}
          />
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#010101]">
              {nearbyModeEnabled ? 'Nearby Courts' : 'Available Courts'}
            </h1>
            <p className="text-gray-600">
              {activeTotal} {activeTotal === 1 ? 'court' : 'courts'} found
              {debouncedSearchQuery && ` for "${debouncedSearchQuery}"`}
            </p>
            {hasCurrentLocation && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNearbyModeEnabled(true);
                    setCurrentPage(1);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    nearbyModeEnabled
                      ? 'border-[#98e209] bg-[#98e209] text-[#010101]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Nearby Courts
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNearbyModeEnabled(false);
                    setCurrentPage(1);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    !nearbyModeEnabled
                      ? 'border-[#98e209] bg-[#98e209] text-[#010101]'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                  }`}
                >
                  Available Courts
                </button>
              </div>
            )}
          </div>

          <Select value={sortByDisplay} onValueChange={setSortByDisplay}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recommended">
                Recommended
              </SelectItem>
              <SelectItem value="price-low">
                Price: Low to High
              </SelectItem>
              <SelectItem value="price-high">
                Price: High to Low
              </SelectItem>
              <SelectItem value="rating">
                Highest Rated
              </SelectItem>
              <SelectItem value="distance">
                Nearest First
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {loading && (
            <div className="col-span-full text-center py-12 text-gray-500">Loading venues...</div>
          )}
          {!loading && error && (
            <div className="col-span-full text-center py-12 text-red-600">{error}</div>
          )}
          {!loading && !error && activeDisplayedCourts.map((court) => (
            <div
              key={court.id}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredCourtId(court.id)}
              onMouseLeave={() => setHoveredCourtId(null)}
              onClick={() => handleCourtCardClick(court.id)}
            >
              <VenueCard
                id={court.id.toString()}
                name={court.name}
                sport={court.sport}
                location={court.location}
                rating={court.rating}
                reviews={court.reviews}
                price={court.price}
                currency={court.currency}
                availability={court.availability}
                image={court.image}
                amenities={court.amenities}
                distance={court.distance}
                openHours={court.openHours}
                onBookNow={() => navigate(`/court/${court.id}`, { 
                  state: { fromAI: fromAI, fromFindCourt: true } 
                })}
                showFavorite
                isFavorite={isFavorite(court.id.toString())}
                onFavoriteToggle={() => handleFavoriteToggle(court)}
              />
            </div>
          ))}
        </div>

        {/* Pagination */}
        {activeTotal > 0 && activeTotalPages > 1 && (
          <div className="flex flex-col items-center gap-4 mt-8">
            {/* Page Info */}
            <div className="text-sm text-gray-600">
              Showing page {currentPage} of {activeTotalPages} ({activeTotal} {activeTotal === 1 ? 'court' : 'courts'})
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-wrap justify-center items-center gap-2 max-w-full">
              {/* Prev */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition flex-shrink-0"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              {/* Pages */}
              <div className="flex flex-wrap items-center gap-2 justify-center">
                {getPaginationPages(currentPage, activeTotalPages).map((page, index) => {
                  if (page === 'ellipsis') {
                    return (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-2 text-gray-400 select-none"
                      >
                        ...
                      </span>
                    );
                  }
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition flex-shrink-0 text-sm
                        ${currentPage === page
                          ? "bg-[#98e209] text-white font-semibold"
                          : "border border-gray-300 text-gray-600 hover:bg-gray-100 hover:border-gray-400"
                        }`}
                      aria-label={`Go to page ${page}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>

              {/* Next */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(activeTotalPages, prev + 1))}
                disabled={currentPage === activeTotalPages}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 transition flex-shrink-0"
                aria-label="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Jump (Optional - for very large datasets) */}
            {activeTotalPages > 20 && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Go to page:</span>
                <input
                  type="number"
                  min="1"
                  max={activeTotalPages}
                  defaultValue={currentPage}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const value = parseInt((e.target as HTMLInputElement).value);
                      if (value >= 1 && value <= activeTotalPages) {
                        setCurrentPage(value);
                      }
                    }
                  }}
                  className="w-20 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-[#98e209] focus:border-transparent"
                />
              </div>
            )}
          </div>
        )}

        {/* No results message */}
        {!loading && !error && activeTotal === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600 mb-2">
              {nearbyModeEnabled ? 'No nearby courts found for your location' : 'No courts match your filters'}
            </p>
            <p className="text-gray-500">
              {nearbyModeEnabled
                ? 'Try moving the map or checking location permission to fetch nearby courts.'
                : 'Try adjusting search, availability, or other filters. If it&apos;s late today, venues may have already closed.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}