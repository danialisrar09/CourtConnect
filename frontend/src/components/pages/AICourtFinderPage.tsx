import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Sparkles,
    DollarSign,
    MapPin,
    Dumbbell,
    Waves,
    Brain,
    Zap,
} from "lucide-react";
import { Button } from "../ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Slider } from "../ui/slider";
import { VenueCard } from "../common";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useFavorites } from "../../hooks";
import { toast } from "sonner";
import aiService, { AIRecommendationParams } from "../../services/aiService";
import { Review } from "../../types";

export function AICourtFinderPage() {
    usePageTitle(
        "AI Court Finder",
        "Discover the perfect sports court using our AI-powered recommendation system"
    );
    const navigate = useNavigate();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [recommendations, setRecommendations] = useState<any[]>([]);
    const [modelUsed, setModelUsed] = useState<string>("");
    const [filterCount, setFilterCount] = useState<number>(0);
    const [favorites, addFavorite, removeFavorite, isFavorite] = useFavorites();
    const [currentSlide, setCurrentSlide] = useState(0);
    const slideIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Sports images from Unsplash for slideshow
    const sportsImages = [
        "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1534158914592-062992fbe900?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1920&q=80&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1576678927484-cc907957088c?w=1920&q=80&auto=format&fit=crop",
    ];


    // Filter states
    const [location, setLocation] = useState("");
    const [sport, setSport] = useState("");
    const [priceRange, setPriceRange] = useState<[number, number] | null>(null);
    const [needsGym, setNeedsGym] = useState(false);
    const [needsPool, setNeedsPool] = useState(false);

    // Price range constants
    const MIN_PRICE = 500;
    const MAX_PRICE = 25000;

    const SPORT_TYPES = [
        "Tennis",
        "Football",
        "Basketball",
        "Badminton",
        "Volleyball",
        "Table Tennis",
        "Cricket",
        "Hockey",
        "Swimming",
        "Gym/Fitness",
    ];

    const LOCATIONS = [
        "Malir",
        "Johar",
        "Gulshan-e-Iqbal",
        "North Nazimabad",
        "DHA",
        "Clifton",
        "Saddar",
    ];


    // Fetch recommendations
    const fetchRecommendations = async () => {
        try {
            setLoading(true);
            setError(null);

            const params: AIRecommendationParams = {
                n: 12, // Get top 12 recommendations
            };

            if (location) params.location = location;
            if (sport) params.sport = sport;
            if (needsGym) params.gym = "yes";
            if (needsPool) params.pool = "yes";

            // Handle price range
            if (priceRange) {
                params.minPrice = priceRange[0];
                params.maxPrice = priceRange[1];
            }

            console.log("=== AI RECOMMENDER PARAMETERS ===");
            console.log("Calling backend with:", params);
            console.log("================================");

            // Call the backend API (which calls FastAPI)
            const response = await aiService.getRecommendations(params);
            
            console.log("=== AI RESPONSE ===");
            console.log(`Model used: ${response.modelUsed}`);
            console.log(`Got ${response.count} recommendations`);
            console.log("===================");
            
            setRecommendations(response.recommendations || []);
            setModelUsed(response.modelUsed || "Default");
            setFilterCount(response.filterCount || 0);
            
        } catch (e: any) {
            console.error("Error fetching recommendations:", e);
            setError(e?.response?.data?.message || "Failed to load recommendations");
        } finally {
            setLoading(false);
        }
    };

    // Filter change handlers
    const handleLocationChange = (value: string) => {
        setLocation(value === "__any__" ? "" : value);
    };

    const handleSportChange = (value: string) => {
        setSport(value === "__any__" ? "" : value);
    };

    const handlePriceRangeChange = (value: number[]) => {
        if (value[0] === MIN_PRICE && value[1] === MAX_PRICE) {
            setPriceRange(null); // Reset if at full range
        } else {
            setPriceRange([value[0], value[1]]);
        }
    };

    // Load recommendations on mount and when filters change
    useEffect(() => {
        fetchRecommendations();
    }, [location, sport, priceRange, needsGym, needsPool]);

    // Slideshow effect
    useEffect(() => {
        slideIntervalRef.current = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % sportsImages.length);
        }, 4000); // Change slide every 4 seconds

        return () => {
            if (slideIntervalRef.current) {
                clearInterval(slideIntervalRef.current);
            }
        };
    }, [sportsImages.length]);

    const handleFavoriteToggle = async (court: any) => {
        const token = localStorage.getItem("authToken");
        if (!token) {
            toast.error("Please login to add favorites");
            navigate("/login");
            return;
        }

        try {
            const courtId = court?.id?.toString() || court?._id?.toString();
            if (!courtId) {
                toast.error("Invalid court ID");
                return;
            }
            
            if (isFavorite(courtId)) {
                await removeFavorite(courtId);
                toast.success(`${court.name} removed from favorites`);
            } else {
                await addFavorite(courtId);
                toast.success(`${court.name} added to favorites`);
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to update favorites");
        }
    };

    const clearFilters = () => {
        setLocation("");
        setSport("");
        setPriceRange(null);
        setNeedsGym(false);
        setNeedsPool(false);
    };

    // Helper to compute local review stats
    const getLocalReviewStats = (venueId: string) => {
        try {
            const store = localStorage.getItem("venueReviews");
            if (!store) return null;
            const reviews = (JSON.parse(store)[venueId] as Review[]) || [];
            if (reviews.length === 0) return null;

            const avgRating =
                reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
            return { rating: avgRating, count: reviews.length };
        } catch (err) {
            return null;
        }
    };

    // Transform recommendations for VenueCard
    const displayedCourts = recommendations.map((v: any) => {
        // Use _id if available (MongoDB ObjectId), otherwise use id (numeric from Python service)
        // Convert to string to ensure consistency
        const venueId = v._id ? String(v._id) : (v.id ? String(v.id) : null);
        const localStats = venueId ? getLocalReviewStats(venueId) : null;

        return {
            id: venueId,
            name: v.name,
            sport: v.sport,
            location: v.location || v.address || "",
            rating: localStats?.rating ?? v.rating ?? 0,
            reviews: localStats?.count ?? v.reviewCount ?? 0,
            price: v.hourlyPrice || v.price || 0,
            currency: v.currency || "PKR",
            availability: v.availabilityText || v.availability || "Available",
            image: v.image || v.images?.[0] || "",
            amenities: v.amenities || [],
            distance: v.distance || "",
            openHours: v.openHours || "",
            matchScore: v.matchScore || 0,
        };
    });

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section with AI Branding and Slideshow */}
            <div className="relative -mt-24 overflow-hidden shadow-lg h-screen flex items-center bg-white">
                {/* Slideshow Background with Unsplash Images */}
                <div className="absolute inset-0 z-0">
                    {sportsImages.map((image, index) => (
                        <div
                            key={index}
                            className={`absolute inset-0 transition-opacity duration-1000 ${
                                index === currentSlide ? "opacity-100 z-10" : "opacity-0 z-0"
                            }`}
                        >
                            <img
                                src={image}
                                alt={`Sports ${index + 1}`}
                                className="w-full h-full object-cover"
                                style={{
                                    filter: "brightness(0.5)",
                                    transform: "scale(1.05)",
                                }}
                                onError={(e) => {
                                    // Fallback if image fails to load
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Dark Overlay for Text Readability */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/50 z-[5]"></div>

                {/* Content */}
                <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full pt-32 pb-16">

                    <div className="text-center mb-6">
                        <div className="flex items-center justify-center mb-4">
                            <Sparkles className="h-12 w-12 mr-3 animate-pulse text-white" />
                            <h1 className="text-4xl font-bold text-white drop-shadow-lg">
                                AI-Powered Court Finder
                            </h1>
                        </div>
                        <p className="text-lg text-white max-w-2xl mx-auto drop-shadow-md">
                            Let our smart AI help you discover the perfect sports court based
                            on your preferences. The more filters you add, the smarter our
                            recommendations get!
                        </p>
                    </div>
                </div>

                {/* Slide Indicators - Bottom Center */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center gap-3">
                    {sportsImages.map((_, index) => (
                        <button
                            key={`indicator-${index}`}
                            type="button"
                            onClick={() => {
                                setCurrentSlide(index);
                                if (slideIntervalRef.current) {
                                    clearInterval(slideIntervalRef.current);
                                }
                                slideIntervalRef.current = setInterval(() => {
                                    setCurrentSlide((prev) => (prev + 1) % sportsImages.length);
                                }, 4000);
                            }}
                            className={`rounded-full transition-all duration-300 ${
                                index === currentSlide
                                    ? "w-4 h-4 bg-[#98e209] shadow-lg"
                                    : "w-3 h-3 bg-white hover:bg-white/90"
                            }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>

            </div>

            {/* Filters Section */}
            <div className="bg-white shadow-sm border-b sticky top-16 z-20 py-6 relative z-10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Main Filters Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        {/* Location */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700">
                                <MapPin className="inline h-4 w-4 mr-1" />
                                Location
                            </label>
                            <Select value={location || "__any__"} onValueChange={handleLocationChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Any location" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__any__">Any location</SelectItem>
                                    {LOCATIONS.map((loc) => (
                                        <SelectItem key={loc} value={loc}>
                                            {loc}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Sport */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700">
                                <Zap className="inline h-4 w-4 mr-1" />
                                Sport
                            </label>
                            <Select value={sport || "__any__"} onValueChange={handleSportChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Any sport" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__any__">Any sport</SelectItem>
                                    {SPORT_TYPES.map((s) => (
                                        <SelectItem key={s} value={s}>
                                            {s}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Price Range */}
                        <div>
                            <label className="block text-sm font-medium mb-2 text-gray-700">
                                <DollarSign className="inline h-4 w-4 mr-1" />
                                Price Range (PKR)
                            </label>
                            <div className="space-y-3">
                                <Slider
                                    value={priceRange ? [priceRange[0], priceRange[1]] : [MIN_PRICE, MAX_PRICE]}
                                    onValueChange={handlePriceRangeChange}
                                    min={MIN_PRICE}
                                    max={MAX_PRICE}
                                    step={100}
                                    className="w-full"
                                />
                                <div className="flex justify-between items-center text-sm text-gray-600">
                                    <span className="font-medium">
                                        {priceRange 
                                            ? `PKR ${priceRange[0].toLocaleString()} - PKR ${priceRange[1].toLocaleString()}`
                                            : `PKR ${MIN_PRICE.toLocaleString()} - PKR ${MAX_PRICE.toLocaleString()} (Any price)`
                                        }
                                    </span>
                                    {priceRange && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setPriceRange(null)}
                                            className="h-6 px-2 text-xs text-gray-500 hover:text-gray-700"
                                        >
                                            Clear
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Gym and Pool Checkboxes */}
                        <div className="flex items-end">
                            <div className="flex flex-row gap-4 w-full">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="gym"
                                        checked={needsGym}
                                        onCheckedChange={(checked: boolean) => setNeedsGym(!!checked)}
                                    />
                                    <label htmlFor="gym" className="text-sm font-medium cursor-pointer flex items-center">
                                        <Dumbbell className="inline h-4 w-4 mr-1" />
                                        Needs Gym
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="pool"
                                        checked={needsPool}
                                        onCheckedChange={(checked: boolean) => setNeedsPool(!!checked)}
                                    />
                                    <label htmlFor="pool" className="text-sm font-medium cursor-pointer flex items-center">
                                        <Waves className="inline h-4 w-4 mr-1" />
                                        Needs Pool
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Clear Filters Button */}
                    {(location ||
                        sport ||
                        priceRange !== null ||
                        needsGym ||
                        needsPool) && (
                            <div className="flex justify-end">
                                <Button
                                    onClick={clearFilters}
                                    variant="outline"
                                    className="text-red-600 border-red-300 hover:bg-red-50"
                                >
                                    Clear All Filters
                                </Button>
                            </div>
                        )}
                </div>
            </div>

            {/* Results Section */}
            <div className="bg-gray-50 py-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-[#010101]">
                                AI Recommendations
                            </h2>
                            <p className="text-gray-600">
                                {recommendations.length}{" "}
                                {recommendations.length === 1 ? "court" : "courts"} found
                                {filterCount > 0 && ` using ${modelUsed}`}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {loading && (
                            <div className="col-span-full text-center py-12 text-gray-500">
                                <Sparkles className="h-8 w-8 animate-spin mx-auto mb-2" />
                                <p>AI is finding the best courts for you...</p>
                            </div>
                        )}
                        {!loading && error && (
                            <div className="col-span-full text-center py-12 text-red-600">
                                {error}
                            </div>
                        )}
                        {!loading &&
                            !error &&
                            displayedCourts.map((court, index) => (
                                <div key={court?.id || index} className="relative">
                                    <VenueCard
                                        id={court?.id?.toString() || String(index)}
                                        name={court?.name || "Unknown Court"}
                                        sport={court?.sport || ""}
                                        location={court?.location || ""}
                                        rating={court?.rating || 4.5}
                                        reviews={court?.reviews || 0}
                                        price={court?.price || 0}
                                        currency={court?.currency || "PKR"}
                                        availability={court?.availability || "Available"}
                                        image={court?.image || "/default-court.jpg"}
                                        amenities={court?.amenities || {}}
                                        distance={court?.distance}
                                        openHours={court?.openHours || "9:00 AM - 10:00 PM"}
                                        onBookNow={async () => {
                                            // If ID is a valid MongoDB ObjectId (24 hex chars), navigate directly
                                            const courtId = court?.id?.toString();
                                            if (courtId && /^[0-9a-fA-F]{24}$/.test(courtId)) {
                                                navigate(`/court/${courtId}`, { state: { fromAI: true } });
                                            } else {
                                                // Search for venue by name and location, passing state to track origin
                                                const searchParams = new URLSearchParams();
                                                if (court?.name) searchParams.set('q', court.name);
                                                if (court?.location) searchParams.set('location', court.location);
                                                navigate(`/find-court?${searchParams.toString()}`, { 
                                                    state: { fromAI: true, courtName: court?.name, courtLocation: court?.location } 
                                                });
                                            }
                                        }}
                                        showFavorite
                                        isFavorite={isFavorite(court?.id?.toString() || String(index))}
                                        onFavoriteToggle={() => handleFavoriteToggle(court)}
                                    />
                                    {/* Match Score Badge */}
                                    {court.matchScore > 0 && (
                                        <div className="absolute top-2 right-2 bg-[#98e209] text-[#010101] px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
                                            {court.matchScore}% Match
                                        </div>
                                    )}
                                </div>
                            ))}
                    </div>

                    {/* No results message */}
                    {!loading && !error && recommendations.length === 0 && (
                        <div className="text-center py-16">
                            <Brain className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                            <p className="text-xl text-gray-600 mb-2">
                                No courts match your criteria
                            </p>
                            <p className="text-gray-500 mb-4">
                                Try adjusting your filters to see more options
                            </p>
                            <Button onClick={clearFilters} variant="outline">
                                Clear All Filters
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
