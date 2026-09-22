import React, { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import venueService from '../../services/venueService';

type MapboxBaseMapProps = {
  className?: string;
  heightClassName?: string;
  heightPx?: number;
  searchQuery?: string;
  sportFilter?: string;
  locationFilter?: string;
  amenitiesFilter?: string[];
  availabilityFilter?: string;
  ratingFilter?: string;
  minPrice?: number;
  maxPrice?: number;
  onCurrentLocationRequested?: () => void;
  onNearbyResultsChange?: (payload: {
    items: NearbyVenueItem[];
    ignoreFilters: boolean;
    locationReady: boolean;
  }) => void;
  highlightedCourtCoords?: { lat: number; lng: number } | null;
  focusedCourt?: { id: string; name: string; sport?: string; location?: string; lat: number; lng: number } | null;
};

const DEFAULT_CENTER: [number, number] = [67.0011, 24.8607];
const DEFAULT_ZOOM = 10;
const SOURCE_ID = 'venues-source';
const CLUSTERS_LAYER_ID = 'clusters-layer';
const CLUSTER_COUNT_LAYER_ID = 'cluster-count-layer';
const UNCLUSTERED_LAYER_ID = 'unclustered-point-layer';
const NEARBY_SOURCE_ID = 'nearby-venues-source';
const NEARBY_LAYER_ID = 'nearby-venues-layer';
const USER_LOCATION_SOURCE_ID = 'user-location-source';
const USER_LOCATION_LAYER_ID = 'user-location-layer';
const ROUTE_SOURCE_ID = 'route-source';
const ROUTE_LAYER_ID = 'route-layer';
const NEARBY_COURTS_PER_PAGE = 6;

type VenueMapItem = {
  id: string;
  name: string;
  sport?: string;
  location?: string;
  coordinates?: {
    lat?: number;
    lng?: number;
  };
  price?: number;
  rating?: number;
  reviews?: number;
};

type NearbyVenueItem = VenueMapItem & {
  distanceMeters?: number;
  distanceKm?: number;
};

type GeocodeFeature = {
  id: string;
  place_name: string;
  center: [number, number];
};

type SearchSuggestion = {
  id: string;
  label: string;
  subLabel?: string;
  center: [number, number];
  kind: 'place' | 'court';
  venueId?: string;
  sport?: string;
  location?: string;
  price?: number;
  rating?: number;
  reviews?: number;
};

type LocationStatus = 'idle' | 'loading' | 'ready' | 'denied' | 'unsupported' | 'error';

type RouteSummary = {
  venueName: string;
  distanceKm: number;
  durationMinutes: number;
  profile: string;
};

type RouteMode = 'car' | 'walking' | 'bike' | 'bus';

type SourceLocation = {
  coordinates: [number, number];
  label: string;
  kind: 'gps' | 'manual';
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const toGeoJson = (items: VenueMapItem[]) => ({
  type: 'FeatureCollection' as const,
  features: items
    .filter((item) => {
      const lat = Number(item.coordinates?.lat);
      const lng = Number(item.coordinates?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    })
    .map((item) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(item.coordinates?.lng), Number(item.coordinates?.lat)] as [number, number],
      },
      properties: {
        id: item.id,
        name: item.name,
        sport: item.sport || '',
        location: item.location || '',
        price: item.price ?? 0,
        rating: item.rating ?? 0,
        reviews: item.reviews ?? 0,
      },
    })),
});

const toNearbyGeoJson = (items: NearbyVenueItem[]) => ({
  type: 'FeatureCollection' as const,
  features: items
    .filter((item) => {
      const lat = Number(item.coordinates?.lat);
      const lng = Number(item.coordinates?.lng);
      return Number.isFinite(lat) && Number.isFinite(lng);
    })
    .map((item) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(item.coordinates?.lng), Number(item.coordinates?.lat)] as [number, number],
      },
      properties: {
        id: item.id,
        name: item.name,
        sport: item.sport || '',
        location: item.location || '',
        price: item.price ?? 0,
        rating: item.rating ?? 0,
        reviews: item.reviews ?? 0,
        distanceKm: item.distanceKm ?? 0,
      },
    })),
});

const toUserLocationGeoJson = (coordinates: [number, number] | null) => ({
  type: 'FeatureCollection' as const,
  features: coordinates
    ? [
        {
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates,
          },
          properties: {},
        },
      ]
    : [],
});

export function MapboxBaseMap({
  className = '',
  heightClassName = 'h-[420px]',
  heightPx = 420,
  searchQuery,
  sportFilter,
  locationFilter,
  amenitiesFilter,
  availabilityFilter,
  ratingFilter,
  minPrice,
  maxPrice,
  onCurrentLocationRequested,
  onNearbyResultsChange,
  highlightedCourtCoords,
  focusedCourt,
}: MapboxBaseMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const locationDropdownRef = useRef<HTMLDivElement | null>(null);
  const sourceLocationRef = useRef<SourceLocation | null>(null);
  const userLocationRef = useRef<[number, number] | null>(null);
  const routeModeRef = useRef<RouteMode>('car');
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const popupRef = useRef<mapboxgl.Popup | null>(null);
  const requestCounterRef = useRef(0);
  const viewportDebounceTimerRef = useRef<number | null>(null);
  const hoverMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [runtimeWarning, setRuntimeWarning] = useState<string | null>(null);
  const [isFetchingVenues, setIsFetchingVenues] = useState(false);
  const [visibleVenueCount, setVisibleVenueCount] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearchInput, setDebouncedSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState<SearchSuggestion[]>([]);
  const [isSearchingSuggestions, setIsSearchingSuggestions] = useState(false);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('idle');
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [currentLocationLabel, setCurrentLocationLabel] = useState('');
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [sourceLocation, setSourceLocation] = useState<SourceLocation | null>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [nearbyVenues, setNearbyVenues] = useState<NearbyVenueItem[]>([]);
  const [isFetchingNearby, setIsFetchingNearby] = useState(false);
  const [nearbyIgnoreFilters, setNearbyIgnoreFilters] = useState(false);
  const [selectedSearchCourt, setSelectedSearchCourt] = useState<NearbyVenueItem | null>(null);
  const [nearbyPage, setNearbyPage] = useState(0);
  const [nearbyRadiusKm] = useState(5);
  const [routeMode, setRouteMode] = useState<RouteMode>('car');
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [isFetchingRoute, setIsFetchingRoute] = useState(false);
  const [lastRoutedVenue, setLastRoutedVenue] = useState<NearbyVenueItem | null>(null);

  useEffect(() => {
    sourceLocationRef.current = sourceLocation;
  }, [sourceLocation]);

  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    routeModeRef.current = routeMode;
  }, [routeMode]);

  const resolveDirectionsProfile = (mode: RouteMode) => {
    if (mode === 'walking') return 'walking';
    if (mode === 'bike') return 'cycling';
    return 'driving';
  };

  const resolveRouteModeLabel = (mode: RouteMode) => {
    if (mode === 'walking') return 'Walking';
    if (mode === 'bike') return 'Bike';
    if (mode === 'bus') return 'Bus (estimated)';
    return 'Car';
  };

  const mapToken = useMemo(() => import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN || '', []);

  const mapRatingBounds = useMemo(() => {
    if (!ratingFilter) {
      return {
        rating: undefined as number | undefined,
        maxRating: undefined as number | undefined,
      };
    }

    if (ratingFilter === 'below-4') {
      return {
        rating: undefined,
        maxRating: 4,
      };
    }

    const parsed = Number.parseFloat(ratingFilter);
    return {
      rating: Number.isFinite(parsed) ? parsed : undefined,
      maxRating: undefined,
    };
  }, [ratingFilter]);

  const hasActiveMapFilters = Boolean(
    (searchQuery || '').trim() ||
      sportFilter ||
      locationFilter ||
      (amenitiesFilter && amenitiesFilter.length > 0) ||
      availabilityFilter ||
      ratingFilter ||
      Number.isFinite(minPrice as number) ||
      Number.isFinite(maxPrice as number),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchInput(searchInput.trim());
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!locationDropdownRef.current) {
        return;
      }

      if (!locationDropdownRef.current.contains(event.target as Node)) {
        setIsLocationDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const clearRoute = () => {
    setRouteSummary(null);
    setRouteError(null);
    setLastRoutedVenue(null);
    if (!mapRef.current) {
      return;
    }

    const routeSource = mapRef.current.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (routeSource) {
      routeSource.setData({
        type: 'FeatureCollection',
        features: [],
      });
    }
  };

  const reverseGeocodeLabel = async (coordinates: [number, number]) => {
    const fallback = `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
    if (!mapToken) {
      return fallback;
    }

    try {
      const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${coordinates[0]},${coordinates[1]}.json`;
      const params = new URLSearchParams({
        access_token: mapToken,
        language: 'en',
        limit: '1',
      });
      const response = await fetch(`${endpoint}?${params.toString()}`);
      const payload = await response.json();
      const feature = Array.isArray(payload?.features) ? payload.features[0] : null;
      const placeName = String(feature?.place_name || '').trim();
      return placeName || fallback;
    } catch {
      return fallback;
    }
  };

  const reverseGeocodeCurrentLocation = async (coordinates: [number, number]) => {
    const label = await reverseGeocodeLabel(coordinates);
    setCurrentLocationLabel(label);
    setSourceLocation({
      coordinates,
      label,
      kind: 'gps',
    });
  };

  const drawRouteToVenue = async (startCoordinates: [number, number], venue: NearbyVenueItem) => {
    const activeMode = routeModeRef.current;
    const profile = resolveDirectionsProfile(activeMode);
    const endLat = Number(venue.coordinates?.lat);
    const endLng = Number(venue.coordinates?.lng);
    if (!Number.isFinite(endLat) || !Number.isFinite(endLng) || !mapRef.current) {
      setRouteError('This court does not have valid coordinates for directions.');
      return;
    }

    setIsFetchingRoute(true);
    setRouteError(null);

    try {
      const response = await venueService.getDirections({
        startLat: startCoordinates[1],
        startLng: startCoordinates[0],
        endLat,
        endLng,
        profile,
      });

      const payload = response?.data || response;
      const geometry = payload?.geometry;
      if (!geometry || !Array.isArray(geometry.coordinates)) {
        throw new Error('Directions geometry is missing.');
      }

      const routeSource = mapRef.current.getSource(ROUTE_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      const routeData = {
        type: 'FeatureCollection' as const,
        features: [
          {
            type: 'Feature' as const,
            geometry,
            properties: {},
          },
        ],
      };

      if (routeSource) {
        routeSource.setData(routeData);
      }

      const bounds = geometry.coordinates.reduce(
        (acc: mapboxgl.LngLatBounds, coord: [number, number]) => acc.extend(coord),
        new mapboxgl.LngLatBounds(geometry.coordinates[0], geometry.coordinates[0]),
      );
      mapRef.current.fitBounds(bounds, { padding: 60, duration: 700 });

      setRouteSummary({
        venueName: venue.name,
        distanceKm: Number(payload?.distanceKm || 0),
        durationMinutes: Number(payload?.durationMinutes || 0),
        profile: resolveRouteModeLabel(activeMode),
      });
      setLastRoutedVenue(venue);
    } catch (error: any) {
      setRouteError(error?.response?.data?.message || error?.message || 'Failed to fetch directions.');
    } finally {
      setIsFetchingRoute(false);
    }
  };

  const requestDirectionsToVenue = async (venue: NearbyVenueItem) => {
    const startCoordinates = sourceLocationRef.current?.coordinates || userLocationRef.current;
    if (!startCoordinates) {
      setRouteError('Set source location first to get directions.');
      return;
    }

    await drawRouteToVenue(startCoordinates, venue);
  };

  const openVenuePopup = (coordinates: [number, number], properties: Record<string, any>) => {
    if (!mapRef.current) {
      return;
    }

    if (popupRef.current) {
      popupRef.current.remove();
    }

    const venueId = String(properties.id || '');
    const venueName = String(properties.name || 'Court');
    const venueSport = String(properties.sport || 'Sport');
    const venueLocation = String(properties.location || 'Karachi');
    const venuePrice = Number(properties.price || 0);
    const venueRating = Number(properties.rating || 0);
    const distanceKm = Number(properties.distanceKm || 0);
    const popupRoot = document.createElement('div');
    popupRoot.style.minWidth = '220px';
    popupRoot.style.fontFamily = 'Arial, sans-serif';

    const title = document.createElement('h4');
    title.textContent = venueName;
    title.style.margin = '0 0 8px';
    title.style.fontSize = '14px';
    title.style.fontWeight = '700';
    title.style.color = '#101010';
    popupRoot.appendChild(title);

    const meta = document.createElement('p');
    meta.textContent = `${venueSport} • ${venueLocation}`;
    meta.style.margin = '0 0 6px';
    meta.style.fontSize = '12px';
    meta.style.color = '#334155';
    popupRoot.appendChild(meta);

    const price = document.createElement('p');
    price.textContent = `PKR ${Number.isFinite(venuePrice) ? venuePrice : 0}/hr • Rating ${venueRating.toFixed(1)}`;
    price.style.margin = '0 0 8px';
    price.style.fontSize = '12px';
    price.style.color = '#334155';
    popupRoot.appendChild(price);

    if (Number.isFinite(distanceKm) && distanceKm > 0) {
      const distance = document.createElement('p');
      distance.textContent = `${distanceKm.toFixed(2)} km away`;
      distance.style.margin = '0 0 12px';
      distance.style.fontSize = '12px';
      distance.style.color = '#334155';
      popupRoot.appendChild(distance);
    }

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';
    actions.style.flexWrap = 'wrap';

    const viewLink = document.createElement('a');
    viewLink.href = `/court/${venueId}`;
    viewLink.textContent = 'View Court';
    viewLink.style.display = 'inline-block';
    viewLink.style.background = '#84cc16';
    viewLink.style.color = '#101010';
    viewLink.style.fontSize = '12px';
    viewLink.style.fontWeight = '700';
    viewLink.style.textDecoration = 'none';
    viewLink.style.padding = '6px 10px';
    viewLink.style.borderRadius = '8px';
    actions.appendChild(viewLink);

    const directionsButton = document.createElement('button');
    directionsButton.type = 'button';
    directionsButton.textContent = sourceLocationRef.current || userLocationRef.current ? 'Directions' : 'Enable location';
    directionsButton.style.display = 'inline-block';
    directionsButton.style.background = '#0f172a';
    directionsButton.style.color = '#ffffff';
    directionsButton.style.fontSize = '12px';
    directionsButton.style.fontWeight = '700';
    directionsButton.style.border = 'none';
    directionsButton.style.padding = '6px 10px';
    directionsButton.style.borderRadius = '8px';
    directionsButton.style.cursor = 'pointer';
    directionsButton.onclick = () => {
      const venueForDirections: NearbyVenueItem = {
        id: venueId,
        name: venueName,
        sport: venueSport,
        location: venueLocation,
        coordinates: { lat: coordinates[1], lng: coordinates[0] },
        price: venuePrice,
        rating: venueRating,
        reviews: Number(properties.reviews || 0),
        distanceKm,
      };

      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }

      if (sourceLocationRef.current || userLocationRef.current) {
        void requestDirectionsToVenue(venueForDirections);
        return;
      }

      requestUserLocation(venueForDirections);
    };
    actions.appendChild(directionsButton);

    popupRoot.appendChild(actions);

    popupRef.current = new mapboxgl.Popup({ offset: 16 })
      .setLngLat(coordinates)
      .setDOMContent(popupRoot)
      .addTo(mapRef.current);
  };

  const loadNearbyVenues = async (
    coordinates: [number, number],
    options?: { ignoreFilters?: boolean },
  ) => {
    const ignoreFilters = options?.ignoreFilters ?? nearbyIgnoreFilters;
    setIsFetchingNearby(true);
    try {
      const response = await venueService.getNearbyVenues({
        lng: coordinates[0],
        lat: coordinates[1],
        radiusKm: nearbyRadiusKm,
        limit: 100,
        q: ignoreFilters ? undefined : (searchQuery || undefined),
        sport: ignoreFilters ? undefined : (sportFilter || undefined),
        location: ignoreFilters ? undefined : (locationFilter || undefined),
        amenities: ignoreFilters
          ? undefined
          : (amenitiesFilter && amenitiesFilter.length ? amenitiesFilter.join(',') : undefined),
        availability: ignoreFilters ? undefined : (availabilityFilter || undefined),
        rating: ignoreFilters ? undefined : mapRatingBounds.rating,
        maxRating: ignoreFilters ? undefined : mapRatingBounds.maxRating,
        minPrice: ignoreFilters ? undefined : (Number.isFinite(minPrice as number) ? Number(minPrice) : undefined),
        maxPrice: ignoreFilters ? undefined : (Number.isFinite(maxPrice as number) ? Number(maxPrice) : undefined),
      });
      const payload = response?.data || response;
      const items = (payload?.items || []) as NearbyVenueItem[];
      setNearbyVenues(items);
      onNearbyResultsChange?.({
        items,
        ignoreFilters,
        locationReady: true,
      });
      setLocationMessage(
        items.length > 0
          ? `${items.length} nearby ${items.length === 1 ? 'court' : 'courts'} within ${nearbyRadiusKm} km`
          : `No nearby courts found within ${nearbyRadiusKm} km`
      );
    } catch (error: any) {
      setNearbyVenues([]);
      onNearbyResultsChange?.({
        items: [],
        ignoreFilters,
        locationReady: locationStatus === 'ready',
      });
      setLocationStatus('error');
      setLocationMessage(error?.response?.data?.message || 'Unable to load nearby courts right now.');
    } finally {
      setIsFetchingNearby(false);
    }
  };

  const requestUserLocation = (venueForDirections?: NearbyVenueItem) => {
    if (!navigator.geolocation) {
      setLocationStatus('unsupported');
      setLocationMessage('This browser does not support location access.');
      return;
    }

    const queuedVenue = venueForDirections || null;

    setIsLocationDropdownOpen(false);
    onCurrentLocationRequested?.();
    setLocationStatus('loading');
    setLocationMessage(queuedVenue ? 'Requesting your location for directions...' : 'Requesting your location...');
    setCurrentLocationLabel('Detecting your current location...');
    setNearbyIgnoreFilters(true);
    setSelectedSearchCourt(null);
    clearRoute();

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates: [number, number] = [position.coords.longitude, position.coords.latitude];
        const fallback = `${coordinates[1].toFixed(5)}, ${coordinates[0].toFixed(5)}`;
        setUserLocation(coordinates);
        setSourceLocation({
          coordinates,
          label: fallback,
          kind: 'gps',
        });
        setLocationStatus('ready');
        setCurrentLocationLabel(fallback);
        void reverseGeocodeCurrentLocation(coordinates);
        if (mapRef.current) {
          mapRef.current.easeTo({
            center: coordinates,
            zoom: Math.max(mapRef.current.getZoom(), 13),
            duration: 700,
          });
        }
        if (queuedVenue) {
          void drawRouteToVenue(coordinates, queuedVenue);
        }
        void loadNearbyVenues(coordinates, { ignoreFilters: true });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('denied');
          setLocationMessage('Location permission was denied. Enable it in your browser to see nearby courts.');
          setCurrentLocationLabel('Location permission denied');
          return;
        }

        setLocationStatus('error');
        setLocationMessage('Unable to determine your location right now.');
        setCurrentLocationLabel('Unable to detect location');
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      },
    );
  };

  const focusNearbyVenue = (venue: NearbyVenueItem) => {
    const lat = Number(venue.coordinates?.lat);
    const lng = Number(venue.coordinates?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !mapRef.current) {
      return;
    }

    const target: [number, number] = [lng, lat];
    mapRef.current.easeTo({
      center: target,
      zoom: Math.max(mapRef.current.getZoom(), 14),
      duration: 600,
    });
    openVenuePopup(target, {
      id: venue.id,
      name: venue.name,
      sport: venue.sport,
      location: venue.location,
      price: venue.price,
      rating: venue.rating,
      reviews: venue.reviews,
      distanceKm: venue.distanceKm,
    });
  };

  useEffect(() => {
    if (!mapLoaded || !mapToken) {
      return;
    }

    if (debouncedSearchInput.length < 2) {
      setSearchResults([]);
      setIsSearchingSuggestions(false);
      return;
    }

    const controller = new AbortController();

    const loadSuggestions = async () => {
      try {
        setIsSearchingSuggestions(true);
        const endpoint = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(debouncedSearchInput)}.json`;
        const params = new URLSearchParams({
          access_token: mapToken,
          autocomplete: 'true',
          country: 'pk',
          bbox: '66.60,24.70,67.65,25.33',
          proximity: '67.0011,24.8607',
          fuzzyMatch: 'true',
          types: 'poi,address,neighborhood,locality,place,district',
          limit: '12',
          language: 'en',
        });

        const placeRequest = fetch(`${endpoint}?${params.toString()}`, {
          signal: controller.signal,
        });

        const courtRequest = venueService.getVenues({
          q: debouncedSearchInput,
          page: 1,
          limit: 8,
          sport: sportFilter || undefined,
          minPrice: Number.isFinite(minPrice as number) ? Number(minPrice) : undefined,
          maxPrice: Number.isFinite(maxPrice as number) ? Number(maxPrice) : undefined,
        });

        const [placesResponse, courtsResponse] = await Promise.allSettled([placeRequest, courtRequest]);

        let placeItems: SearchSuggestion[] = [];
        if (placesResponse.status === 'fulfilled' && placesResponse.value.ok) {
          const payload = await placesResponse.value.json();
          const features = Array.isArray(payload?.features) ? payload.features : [];
          placeItems = features
            .filter((feature: any) => Array.isArray(feature?.center) && feature.center.length === 2)
            .map((feature: GeocodeFeature) => ({
              id: `place-${String(feature.id || feature.place_name)}`,
              label: String(feature.place_name || 'Unknown location'),
              center: [Number(feature.center[0]), Number(feature.center[1])] as [number, number],
              kind: 'place' as const,
            }));
        }

        let courtItems: SearchSuggestion[] = [];
        if (courtsResponse.status === 'fulfilled') {
          const payload = courtsResponse.value?.data || courtsResponse.value;
          const items = Array.isArray(payload?.items) ? payload.items : [];
          courtItems = items
            .filter((item: any) => Number.isFinite(Number(item?.coordinates?.lat)) && Number.isFinite(Number(item?.coordinates?.lng)))
            .map((item: any) => ({
              id: `court-${String(item.id || item._id || item.name)}`,
              venueId: String(item.id || item._id || ''),
              label: String(item.name || 'Court'),
              subLabel: `${String(item.sport || 'Sport')} • ${String(item.location || 'Karachi')}`,
              center: [Number(item.coordinates.lng), Number(item.coordinates.lat)] as [number, number],
              kind: 'court' as const,
              sport: String(item.sport || 'Sport'),
              location: String(item.location || 'Karachi'),
              price: Number(item.price || 0),
              rating: Number(item.rating || 0),
              reviews: Number(item.reviews || 0),
            }));
        }

        const merged = [...courtItems, ...placeItems]
          .filter(
            (item, index, arr) =>
              arr.findIndex(
                (other) => other.label.trim().toLowerCase() === item.label.trim().toLowerCase(),
              ) === index,
          )
          .slice(0, 12);

        setSearchResults(merged);
      } catch (error: any) {
        if (error?.name !== 'AbortError') {
          setRuntimeWarning('Search is temporarily unavailable.');
        }
      } finally {
        setIsSearchingSuggestions(false);
      }
    };

    void loadSuggestions();

    return () => {
      controller.abort();
    };
  }, [debouncedSearchInput, mapLoaded, mapToken, sportFilter, minPrice, maxPrice]);

  const handleSelectSuggestion = (suggestion: SearchSuggestion) => {
    if (!mapRef.current) {
      return;
    }

    const sourceLabel = suggestion.kind === 'court' && suggestion.subLabel
      ? `${suggestion.label} (${suggestion.subLabel})`
      : suggestion.label;

    setSearchInput(sourceLabel);
    setSearchResults([]);
    setIsLocationDropdownOpen(false);
    setRouteError(null);
    setSelectedSearchCourt(null);
    setSourceLocation({
      coordinates: suggestion.center,
      label: sourceLabel,
      kind: 'manual',
    });
    setCurrentLocationLabel(sourceLabel);
    setLocationStatus('ready');
    setLocationMessage(`Source location set to ${sourceLabel}`);

    const map = mapRef.current;
    map.once('moveend', () => {
      void loadViewportVenues();
      void loadNearbyVenues(suggestion.center, { ignoreFilters: true });
    });
    map.easeTo({
      center: suggestion.center,
      zoom: Math.max(map.getZoom(), 13),
      duration: 700,
    });
  };

  const handleSearchSubmit = () => {
    const query = searchInput.trim().toLowerCase();
    if (!query || searchResults.length === 0) {
      return;
    }

    const exactCourt = searchResults.find(
      (result) => result.kind === 'court' && result.label.trim().toLowerCase() === query,
    );
    if (exactCourt) {
      handleSelectSuggestion(exactCourt);
      return;
    }

    const startsWithCourt = searchResults.find(
      (result) => result.kind === 'court' && result.label.trim().toLowerCase().startsWith(query),
    );
    if (startsWithCourt) {
      handleSelectSuggestion(startsWithCourt);
      return;
    }

    handleSelectSuggestion(searchResults[0]);
  };

  const loadViewportVenues = async () => {
    if (!mapRef.current || !mapLoaded) {
      return;
    }

    const map = mapRef.current;
    const bounds = map.getBounds();
    if (!bounds) {
      return;
    }

    const requestId = ++requestCounterRef.current;
    setIsFetchingVenues(true);

    try {
      const response = await venueService.getViewportVenues({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest(),
        q: searchQuery || undefined,
        sport: sportFilter || undefined,
        location: locationFilter || undefined,
        amenities: amenitiesFilter && amenitiesFilter.length ? amenitiesFilter.join(',') : undefined,
        availability: availabilityFilter || undefined,
        rating: mapRatingBounds.rating,
        maxRating: mapRatingBounds.maxRating,
        minPrice: Number.isFinite(minPrice as number) ? Number(minPrice) : undefined,
        maxPrice: Number.isFinite(maxPrice as number) ? Number(maxPrice) : undefined,
      });

      if (requestId !== requestCounterRef.current || !mapRef.current) {
        return;
      }

      const payload = response?.data || response;
      const items = (payload?.items || []) as VenueMapItem[];
      setVisibleVenueCount(items.length);
      const geoJson = toGeoJson(items);

      const existingSource = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (existingSource) {
        existingSource.setData(geoJson);
      } else {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: geoJson,
          cluster: true,
          clusterMaxZoom: 12,
          clusterRadius: 35,
        });

        map.addLayer({
          id: CLUSTERS_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#84cc16',
            'circle-radius': [
              'step',
              ['get', 'point_count'],
              18,
              20,
              22,
              60,
              28,
            ],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: CLUSTER_COUNT_LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size': 12,
          },
          paint: {
            'text-color': '#101010',
          },
        });

        map.addLayer({
          id: UNCLUSTERED_LAYER_ID,
          type: 'circle',
          source: SOURCE_ID,
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#166534',
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#dcfce7',
          },
        });

        map.addSource(NEARBY_SOURCE_ID, {
          type: 'geojson',
          data: toNearbyGeoJson([]),
        });

        map.addLayer({
          id: NEARBY_LAYER_ID,
          type: 'circle',
          source: NEARBY_SOURCE_ID,
          paint: {
            'circle-color': '#f97316',
            'circle-radius': 9,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#fff7ed',
          },
        });

        map.addSource(USER_LOCATION_SOURCE_ID, {
          type: 'geojson',
          data: toUserLocationGeoJson(null),
        });

        map.addLayer({
          id: USER_LOCATION_LAYER_ID,
          type: 'circle',
          source: USER_LOCATION_SOURCE_ID,
          paint: {
            'circle-color': '#2563eb',
            'circle-radius': 10,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#dbeafe',
          },
        });

        map.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
        });

        map.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
          paint: {
            'line-color': '#2563eb',
            'line-width': 5,
            'line-opacity': 0.9,
          },
        });

        map.on('click', CLUSTERS_LAYER_ID, (event) => {
          const features = map.queryRenderedFeatures(event.point, {
            layers: [CLUSTERS_LAYER_ID],
          });
          const clusterFeature = features?.[0];
          if (!clusterFeature) {
            return;
          }

          const clusterId = clusterFeature.properties?.cluster_id;
          const source = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource;
          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (error || typeof zoom !== 'number') {
              return;
            }

            const geometry = clusterFeature.geometry as GeoJSON.Point;
            map.easeTo({
              center: geometry.coordinates as [number, number],
              zoom,
              duration: 600,
            });
          });
        });

        map.on('click', UNCLUSTERED_LAYER_ID, (event) => {
          const feature = event.features?.[0];
          const geometry = feature?.geometry as GeoJSON.Point | undefined;
          const properties = feature?.properties || {};

          if (!geometry) {
            return;
          }

          openVenuePopup(geometry.coordinates as [number, number], properties);
        });

        map.on('click', NEARBY_LAYER_ID, (event) => {
          const feature = event.features?.[0];
          const geometry = feature?.geometry as GeoJSON.Point | undefined;
          const properties = feature?.properties || {};

          if (!geometry) {
            return;
          }

          openVenuePopup(geometry.coordinates as [number, number], properties);
        });

        map.on('mouseenter', CLUSTERS_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', CLUSTERS_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', UNCLUSTERED_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', UNCLUSTERED_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
        map.on('mouseenter', NEARBY_LAYER_ID, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', NEARBY_LAYER_ID, () => {
          map.getCanvas().style.cursor = '';
        });
      }
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || 'Failed to load courts for this map area';
      setRuntimeWarning(String(message));
      setVisibleVenueCount(0);
    } finally {
      if (requestId === requestCounterRef.current) {
        setIsFetchingVenues(false);
      }
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    if (!mapToken) {
      setConfigError('Map token is missing. Add VITE_MAPBOX_PUBLIC_TOKEN in frontend/.env.');
      return;
    }

    mapboxgl.accessToken = mapToken;

    try {
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right');

      map.on('load', () => {
        setMapLoaded(true);
        setRuntimeWarning(null);
      });

      map.on('error', (event) => {
        const detail =
          typeof event?.error?.message === 'string' && event.error.message.trim().length > 0
            ? event.error.message
            : null;

        setRuntimeWarning(
          detail
            ? `Map resource warning: ${detail}`
            : 'Map resource warning. Please check token permissions and network.',
        );
      });

      mapRef.current = map;
    } catch (error) {
      setConfigError('Failed to initialize map.');
    }

    return () => {
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapToken]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) {
      return;
    }

    const map = mapRef.current;
    const scheduleViewportLoad = () => {
      if (viewportDebounceTimerRef.current) {
        window.clearTimeout(viewportDebounceTimerRef.current);
      }
      viewportDebounceTimerRef.current = window.setTimeout(() => {
        void loadViewportVenues();
      }, 220);
    };

    const onMoveEnd = () => {
      scheduleViewportLoad();
    };

    map.on('moveend', onMoveEnd);
    scheduleViewportLoad();

    return () => {
      map.off('moveend', onMoveEnd);
      if (viewportDebounceTimerRef.current) {
        window.clearTimeout(viewportDebounceTimerRef.current);
      }
    };
  }, [
    mapLoaded,
    searchQuery,
    sportFilter,
    locationFilter,
    availabilityFilter,
    amenitiesFilter,
    minPrice,
    maxPrice,
    mapRatingBounds.rating,
    mapRatingBounds.maxRating,
  ]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) {
      return;
    }

    const nearbySource = mapRef.current.getSource(NEARBY_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (nearbySource) {
      nearbySource.setData(toNearbyGeoJson(nearbyVenues));
    }

    const userLocationSource = mapRef.current.getSource(USER_LOCATION_SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
    if (userLocationSource) {
      userLocationSource.setData(toUserLocationGeoJson(userLocation));
    }
  }, [mapLoaded, nearbyVenues, userLocation]);

  useEffect(() => {
    if (locationStatus === 'ready' && nearbyIgnoreFilters && hasActiveMapFilters) {
      setNearbyIgnoreFilters(false);
    }
  }, [locationStatus, nearbyIgnoreFilters, hasActiveMapFilters]);

  useEffect(() => {
    if (userLocation && locationStatus === 'ready') {
      void loadNearbyVenues(userLocation, { ignoreFilters: nearbyIgnoreFilters });
    }
  }, [
    userLocation,
    locationStatus,
    nearbyIgnoreFilters,
    searchQuery,
    sportFilter,
    locationFilter,
    amenitiesFilter,
    availabilityFilter,
    minPrice,
    maxPrice,
    mapRatingBounds.rating,
    mapRatingBounds.maxRating,
  ]);

  useEffect(() => {
    setNearbyPage(0);
  }, [nearbyVenues.length, selectedSearchCourt]);

  // Inject pulse keyframe CSS once for hover marker animation
  useEffect(() => {
    const styleId = 'map-court-pulse-keyframe';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes mapCourtPulse {
          0%   { transform: scale(1);   opacity: 0.9; }
          50%  { transform: scale(1.55); opacity: 0.4; }
          100% { transform: scale(1);   opacity: 0.9; }
        }
        .map-court-hover-ring {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(152, 226, 9, 0.22);
          border: 2.5px solid #98e209;
          animation: mapCourtPulse 1.2s ease-in-out infinite;
          pointer-events: none;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // Show pulsing hover ring on map when a court card is hovered
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (hoverMarkerRef.current) {
      hoverMarkerRef.current.remove();
      hoverMarkerRef.current = null;
    }
    if (!highlightedCourtCoords) return;
    const { lat, lng } = highlightedCourtCoords;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const el = document.createElement('div');
    el.className = 'map-court-hover-ring';
    hoverMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
      .setLngLat([lng, lat])
      .addTo(mapRef.current);
  }, [mapLoaded, highlightedCourtCoords]);

  // Fly to court + show popup + auto-directions when a card is clicked
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !focusedCourt) return;
    const { lat, lng, id, name, sport, location } = focusedCourt;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const coords: [number, number] = [lng, lat];
    mapRef.current.easeTo({ center: coords, zoom: Math.max(mapRef.current.getZoom(), 15), duration: 700 });
    openVenuePopup(coords, { id, name, sport: sport || '', location: location || '' });
    if (sourceLocation || userLocation) {
      void requestDirectionsToVenue({ id, name, sport, location, coordinates: { lat, lng } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapLoaded, focusedCourt]);

  useEffect(() => {
    if (!lastRoutedVenue) {
      return;
    }
    const startCoordinates = sourceLocationRef.current?.coordinates || userLocationRef.current;
    if (!startCoordinates) {
      return;
    }
    void drawRouteToVenue(startCoordinates, lastRoutedVenue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeMode]);

  if (configError) {
    return (
      <div className={`rounded-xl border border-red-200 bg-red-50 p-4 ${className}`}>
        <p className="text-sm text-red-700">{configError}</p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      {!mapLoaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <p className="text-sm text-gray-600">Loading map...</p>
        </div>
      )}
      {runtimeWarning && mapLoaded && (
        <div className="absolute bottom-3 left-3 right-3 z-20 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">{runtimeWarning}</p>
        </div>
      )}
      {isFetchingVenues && mapLoaded && (
        <div className="absolute top-3 left-3 z-20 rounded-md bg-white/90 px-3 py-1 shadow-sm">
          <p className="text-xs font-medium text-gray-700">Loading courts...</p>
        </div>
      )}
      {!isFetchingVenues && mapLoaded && (
        <div className="absolute top-3 left-3 z-20 rounded-md bg-white/90 px-3 py-1 shadow-sm">
          <p className="text-xs font-medium text-gray-700">
            {visibleVenueCount > 0
              ? `${visibleVenueCount} courts in this view`
              : 'No courts in this area'}
          </p>
        </div>
      )}
      <div className="px-3 pt-3">
        <div className="mx-auto w-full max-w-[420px] rounded-md border-2 border-lime-500 bg-white p-2 shadow-lg">
          <div className="mt-3 rounded-md border-2 border-black bg-white p-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-black">Nearby Courts</p>
            <p className="mt-1 text-xs text-gray-800">Use your current location to find courts around you and highlight them on the map.</p>
            <div ref={locationDropdownRef} className="relative mt-3">
              <button
                type="button"
                onClick={() => setIsLocationDropdownOpen((prev) => !prev)}
                className="flex min-h-[52px] w-full items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-black shadow-inner transition hover:border-gray-400"
              >
                <span className="truncate text-black">
                  {currentLocationLabel || 'Select location'}
                </span>
                <span className="ml-3 shrink-0 text-base leading-none text-black">
                  {isLocationDropdownOpen ? '▴' : '▾'}
                </span>
              </button>
              {isLocationDropdownOpen && (
                <div className="relative mt-2 z-30 overflow-hidden rounded-md border border-gray-300 bg-white shadow-lg">
                  <button
                    type="button"
                    onClick={requestUserLocation}
                    disabled={locationStatus === 'loading'}
                    className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-black transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-400"
                  >
                    <span>{locationStatus === 'loading' ? 'Finding current location...' : 'Use your current location'}</span>
                    <span className="ml-3 shrink-0 text-xs text-gray-600">GPS</span>
                  </button>
                  <div className="border-t border-gray-200 p-3">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Search source location"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-black placeholder:text-gray-500 focus:border-gray-400 focus:outline-none"
                    />
                    {isSearchingSuggestions && (
                      <p className="mt-2 text-xs text-gray-500">Searching locations...</p>
                    )}
                    {!isSearchingSuggestions && searchResults.length > 0 && (
                      <div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-gray-200">
                        {searchResults.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => handleSelectSuggestion(suggestion)}
                            className="block w-full border-b border-gray-100 px-3 py-2 text-left text-sm text-black transition last:border-b-0 hover:bg-gray-50"
                          >
                            <p className="truncate font-medium text-black">{suggestion.label}</p>
                            {suggestion.subLabel && <p className="truncate text-xs text-gray-500">{suggestion.subLabel}</p>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-black">Nearby radius: {nearbyRadiusKm} km</span>
            </div>
          </div>
          {locationMessage && (
            <p className="mt-2 text-xs text-gray-600">{locationMessage}</p>
          )}
        </div>
      </div>
      <div
        ref={mapContainerRef}
        className={`w-full min-h-[320px] ${heightClassName}`}
        style={{ height: `${heightPx}px` }}
      />
      {(routeSummary || routeError || isFetchingRoute) && (
        <div className="border-t border-gray-200 bg-blue-50 px-3 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRouteMode('car')}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${routeMode === 'car' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
            >
              Car
            </button>
            <button
              type="button"
              onClick={() => setRouteMode('walking')}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${routeMode === 'walking' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
            >
              Walking
            </button>
            <button
              type="button"
              onClick={() => setRouteMode('bike')}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${routeMode === 'bike' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
            >
              Bike
            </button>
            <button
              type="button"
              onClick={() => setRouteMode('bus')}
              className={`rounded-md border px-3 py-1 text-xs font-semibold transition ${routeMode === 'bus' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`}
            >
              Bus
            </button>
          </div>
          {isFetchingRoute && <p className="text-sm font-medium text-blue-900">Loading route...</p>}
          {routeError && <p className="text-sm font-medium text-red-700">{routeError}</p>}
          {routeSummary && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Route to {routeSummary.venueName}</h3>
                <p className="text-sm text-slate-700">
                  {routeSummary.distanceKm.toFixed(2)} km • {routeSummary.durationMinutes} min • {routeSummary.profile}
                </p>
              </div>
              <button
                type="button"
                onClick={clearRoute}
                className="rounded-md border border-slate-400 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                Clear Route
              </button>
            </div>
          )}
        </div>
      )}
      {selectedSearchCourt && (
        <div className="border-t border-gray-200 bg-gray-50 px-3 py-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Search Result</h3>
          </div>
          <div className="w-full rounded-lg border border-lime-200 bg-white px-3 py-3 text-left shadow-sm">
            <p className="text-sm font-semibold text-gray-900">{selectedSearchCourt.name}</p>
            <p className="mt-1 text-xs text-gray-600">{selectedSearchCourt.sport || 'Sport'} • {selectedSearchCourt.location || 'Karachi'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => focusNearbyVenue(selectedSearchCourt)}
                className="rounded-md border border-lime-300 bg-lime-50 px-3 py-2 text-xs font-semibold text-lime-800"
              >
                Open on map
              </button>
              <button
                type="button"
                onClick={() => void requestDirectionsToVenue(selectedSearchCourt)}
                className="rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
              >
                Directions
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
