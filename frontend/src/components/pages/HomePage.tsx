import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  MapPin,
  Star,
  Users,
  Calendar,
  Trophy,
  Shield,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Brain,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { usePageTitle } from "../../hooks/usePageTitle";
import { TextRotate } from "../ui/text-rotate";
import venueService from "../../services/venueService";
import aiService, { type NLPSearchResult } from "../../services/aiService";

export function HomePage() {
  usePageTitle('Home', 'Book sports courts and venues online with CourtConnect. Find and reserve your perfect court for badminton, tennis, football and more.');
  const navigate = useNavigate();
  const [featuredVenues, setFeaturedVenues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sportCounts, setSportCounts] = useState<Record<string, number>>({});

  // ── NLP Smart Search state ──────────────────────────────────────────────────
  const [isNlpLoading, setIsNlpLoading] = useState(false);
  const [nlpResult, setNlpResult] = useState<NLPSearchResult | null>(null);
  const [nlpError, setNlpError] = useState<string | null>(null);

  const rotatingWords = ["Indoor", "Padel", "Futsal", "Tennis", "Football"];

  /**
   * Smart search: calls NLP endpoint first, builds structured URL params from
   * the extracted intent, then navigates to FindCourtPage with all filters pre-filled.
   * Falls back to plain ?q= redirect if the NLP call fails entirely.
   */
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      navigate('/find-court');
      return;
    }

    setIsNlpLoading(true);
    setNlpResult(null);
    setNlpError(null);

    try {
      const result = await aiService.nlpSearch(q);
      setNlpResult(result);

      // Build URL params from extracted entities
      const params = new URLSearchParams();
      const { entities } = result;

      // Always send the cleaned query for text search
      if (entities.query) params.set('q', entities.query);
      if (entities.sport) params.set('sport', entities.sport);
      if (entities.location) params.set('location', entities.location);
      if (entities.availability) params.set('availability', entities.availability);
      if (entities.minPrice != null) params.set('minPrice', String(entities.minPrice));
      if (entities.maxPrice != null) params.set('maxPrice', String(entities.maxPrice));
      if (entities.amenities?.length) params.set('amenities', entities.amenities.join(','));
      if (entities.sortBy) params.set('sortBy', entities.sortBy);
      if (entities.rating) params.set('rating', entities.rating);

      navigate(`/find-court?${params.toString()}`, {
        state: { fromNLP: true, intent: result },
      });
    } catch (err: any) {
      console.warn('[HomePage] NLP search failed, falling back to plain search:', err?.message);
      setNlpError('Smart search unavailable — using regular search.');
      // Graceful fallback: plain keyword search
      navigate(`/find-court?q=${encodeURIComponent(q)}`);
    } finally {
      setIsNlpLoading(false);
    }
  };

  // Fetch featured venues from backend
  useEffect(() => {
    const fetchFeaturedVenues = async () => {
      try {
        setLoading(true);
        const response = await venueService.getVenues({ 
          limit: 6, 
          sortBy: 'rating-desc' 
        });
        
        if (response.success && response.data?.items) {
          setFeaturedVenues(response.data.items);
        }
      } catch (error) {
        console.error('Failed to fetch featured venues:', error);
        // Keep empty array on error
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedVenues();
  }, []);

  // Fetch sport statistics
  useEffect(() => {
    const fetchSportStats = async () => {
      try {
        const response = await venueService.getSportStats();
        if (response.success && response.data?.sportCounts) {
          setSportCounts(response.data.sportCounts);
        }
      } catch (error) {
        console.error('Failed to fetch sport stats:', error);
      }
    };

    fetchSportStats();
  }, []);

  const popularSports = [
    { 
      name: "Padel", 
      icon: "🎾", 
      courts: 10,
      image: "/padel_white.png",
      description: "Fast-paced racquet sport combining tennis and squash elements, played in doubles on an enclosed court."
    },
    { 
      name: "Football", 
      icon: "⚽", 
      courts: 10,
      image: "/football.png",
      description: "The beautiful game played on full-sized pitches with professional-grade turf and floodlighting."
    },
    { 
      name: "Tennis", 
      icon: "🎾", 
      courts: 10,
      image: "/padel_white.png",
      description: "Professional tennis courts with high-quality surfaces for singles and doubles matches."
    },
    { 
      name: "Futsal", 
      icon: "⚽", 
      courts: 10,
      image: "/futsal.png",
      description: "Indoor football variant with 5 players per side, emphasizing ball control and quick decision-making."
    },
    { 
      name: "Indoor Cricket", 
      icon: "🏏", 
      courts: 10,
      image: "/indoor.png",
      description: "All-weather cricket facilities with proper nets, pitch, and batting cages for year-round practice."
    },
    { 
      name: "Gym/Fitness", 
      icon: "💪", 
      courts: 10,
      image: "/gym.png",
      description: "Fully equipped fitness centers with modern cardio machines, free weights, and strength training equipment."
    },
  ];

  const features = [
    {
      icon: <Search className="h-8 w-8 text-[#98e209]" />,
      title: "Easy Search",
      description:
        "Find courts by location, sport, price, and availability",
    },
    {
      icon: <Calendar className="h-8 w-8 text-[#98e209]" />,
      title: "Instant Booking",
      description:
        "Book your favorite courts instantly with real-time availability",
    },
    {
      icon: <Shield className="h-8 w-8 text-[#98e209]" />,
      title: "Secure Payment",
      description:
        "Safe and secure payment processing with multiple options",
    },
    {
      icon: <Users className="h-8 w-8 text-[#98e209]" />,
      title: "Community",
      description:
        "Connect with other players and join local sports communities",
    },
  ];

  const contentVariants = {
    initial: { y: 40, opacity: 0 },
    hover: { y: 0, opacity: 1, transition: { duration: 0.4 } },
  };

  const arrowVariants = {
    initial: { opacity: 0, y: 20 },
    hover: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };


  return (
    <div className="min-h-screen">
      {/* Hero Section - Full Screen */}
      <section
        className="relative h-screen overflow-hidden bg-cover bg-center bg-no-repeat pt-32"
        style={{
          backgroundImage: `url('https://images.unsplash.com/photo-1539297991909-a76b23f3936c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx8fHwxNzU5MDkyOTMwfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
        }}
      >
        {/* Main Content - Centered */}
        <div className="absolute inset-0 flex items-center justify-center pt-20">
          <div className="text-center space-y-6 px-4">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <h1 className="text-6xl lg:text-7xl font-bold text-white leading-tight mb-8 mt-100">
                Book Your Perfect
                <span className="block perspective">
                  <TextRotate
                    texts={rotatingWords}
                    mainClassName="text-[#98e209] inline-block"
                    staggerFrom="last"
                    initial={{ y: "100%", opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: "-120%", opacity: 0 }}
                    staggerDuration={0.015}
                    splitLevelClassName="overflow-hidden"
                    elementLevelClassName="inline-block"
                    transition={{ 
                      type: "spring", 
                      damping: 40,
                      stiffness: 200
                    }}
                    rotationInterval={3000}
                  />
                  <span className="text-white"> Court</span>
                </span>
              </h1>
            </motion.div>

            {/* Search Bar - Below Heading */}
            <motion.div
              className="w-full max-w-3xl mx-auto mb-8"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="flex items-center gap-1 text-xs font-semibold text-white bg-black/40 backdrop-blur-sm px-3 py-1 rounded-full border border-white/40">
                  <Brain className="h-3 w-3 text-white" />
                  AI Enhanced Search
                </span>
              </div>

              <div className="bg-white rounded-full shadow-lg p-2">
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    id="home-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setNlpResult(null);
                      setNlpError(null);
                    }}
                    placeholder="e.g. cheap football courts in Gulshan with parking on weekends"
                    className="flex-1 px-6 py-4 bg-transparent border-none outline-none text-[#010101] text-lg placeholder-gray-400"
                    disabled={isNlpLoading}
                  />
                  <Button
                    id="home-search-btn"
                    type="submit"
                    disabled={isNlpLoading}
                    className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08] disabled:opacity-70 px-8 py-4 rounded-full mr-7 flex items-center gap-2 min-w-[120px] justify-center"
                  >
                    {isNlpLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Search className="h-5 w-5" />
                        <span>Search</span>
                      </>
                    )}
                  </Button>
                </form>
              </div>

              {/* AI Enhanced interpretation feedback */}
              <AnimatePresence>
                {nlpResult && !isNlpLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 mx-2 px-4 py-3 bg-black/50 backdrop-blur-sm rounded-2xl border border-[#98e209]/30 text-sm text-white"
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-[#98e209] mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <span className="text-[#98e209] font-semibold">AI Enhanced Search detected: </span>
                        {nlpResult.entities.sport && <span>🏅 <b>{nlpResult.entities.sport}</b> · </span>}
                        {nlpResult.entities.location && <span>📍 <b>{nlpResult.entities.location}</b> · </span>}
                        {nlpResult.entities.availability && <span>🕐 <b>{nlpResult.entities.availability}</b> · </span>}
                        {nlpResult.entities.maxPrice && <span>💰 under <b>Rs {nlpResult.entities.maxPrice}</b> · </span>}
                        {nlpResult.entities.amenities?.length ? <span>✅ <b>{nlpResult.entities.amenities.join(', ')}</b> · </span> : null}
                        {nlpResult.entities.sortBy === 'price-asc' && <span>📊 <b>cheapest first</b> · </span>}
                        {nlpResult.entities.sortBy === 'rating-desc' && <span>⭐ <b>top rated first</b> · </span>}
                        <span className="text-gray-400 text-xs ml-1">
                          via {nlpResult.usedMethod === 'grok_api' ? '⚡ Grok AI' : '⚡ AI Enhanced (local)'} · {nlpResult.latencyMs}ms
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
                {nlpError && !isNlpLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-3 mx-2 px-4 py-2 bg-black/40 rounded-2xl text-xs text-yellow-300 text-center"
                  >
                    ⚠️ {nlpError}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.p
              className="text-2xl text-white max-w-3xl mx-auto text-bold"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Discover and book premium sports facilities near
              you. From tennis courts to football fields -
              find your game today.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row gap-6 justify-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <Button
                onClick={() => navigate("/find-court")}
                className="bg-white text-[#010101] hover:bg-[#98e209] px-12 py-6 text-xl rounded-full"
              >
                Find Courts Now
              </Button>
              <Button
                onClick={() => navigate("/about")}
                className="bg-white text-[#010101] hover:bg-[#98e209] px-12 py-6 text-xl rounded-full"
              >
                Who are we?
              </Button>
            </motion.div>

            {/* Quick Stats */}
            <motion.div
              className="flex flex-wrap gap-12 justify-center pt-12"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              <div className="text-center">
                <div className="text-5xl font-bold text-white">
                  500+
                </div>
                <div className="text-white text-xl">
                  Courts Available
                </div>
              </div>
              <div className="text-center">
                <div className="text-5xl font-bold text-white">
                  10K+
                </div>
                <div className="text-white text-xl">
                  Happy Players
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Floating elements */}
        <motion.div
          className="absolute bottom-8 right-8 w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Trophy className="h-12 w-12 text-[#98e209]" />
        </motion.div>
      </section>

      {/* Popular Sports Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#010101] mb-4">
              Popular Sports
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Choose from a wide variety of sports and find the
              perfect court for your game
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {popularSports.map((sport, index) => (
              <Card
                key={index}
                className="sport-card hover:shadow-xl transition-shadow cursor-pointer overflow-hidden"
              >
                <div className="sport-card-image-container">
                  <ImageWithFallback
                    src={sport.image}
                    alt={sport.name}
                    className="sport-card-image"
                  />
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-3xl">{sport.icon}</span>
                    <h3 className="font-bold text-xl text-[#010101]">
                      {sport.name}
                    </h3>
                  </div>
                  <p className="text-gray-600 text-sm mb-3 leading-relaxed">
                    {sport.description}
                  </p>
                  <p className="text-[#98e209] font-semibold text-sm">
                    {sportCounts[sport.name] || 0} courts available
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#010101] mb-4">
              Why Choose CourtConnect?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Experience the easiest way to find and book sports
              facilities
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center">
                <div className="bg-gray-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-xl text-[#010101] mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Venues Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-[#010101] mb-4">
              Featured Venues
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover premium sports facilities with top
              ratings and amenities
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-[#98e209] border-r-transparent"></div>
              <p className="mt-4 text-gray-600">Loading venues...</p>
            </div>
          ) : featuredVenues.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No venues available yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredVenues.map((venue) => (
                <motion.div
                  key={venue.id}
                  className="venue-card"
                  whileHover="hover"
                  initial="initial"
                  animate="initial"
                  onClick={() => navigate(`/court/${venue.slug || venue.id}`)}
                >
                  <motion.div
                    className="venue-bg"
                    style={{ backgroundImage: `url(${venue.image || '/placeholder-venue.jpg'})` }}
                    variants={{
                      initial: { scale: 1 },
                      hover: { scale: 1.06, transition: { duration: 0.4 } }
                    }}
                  />

                  <div className="venue-overlay" />

                  <div className="venue-content">
                    <h3>{venue.name}</h3>

                    <div className="venue-row">
                      <MapPin className="icon" />
                      <span>{venue.location || 'Location not specified'}</span>
                    </div>

                    <div className="venue-row">
                      <Star className="icon star" />
                      <span>{venue.rating?.toFixed(1) || '0.0'}</span>
                      <span className="muted">({venue.reviews || 0} reviews)</span>
                    </div>

                    <div className="amenity-row">
                      {venue.amenities?.slice(0, 3).map((a: string, i: number) => (
                        <span key={i} className="amenity-pill">{a}</span>
                      ))}
                    </div>
                  </div>

                  <motion.button
                    className="venue-arrow"
                    variants={{
                      initial: { opacity: 1, x: 0 },
                      hover: { x: 4, transition: { duration: 0.25 } }
                    }}
                  >
                    <ArrowUpRight className="arrow-icon" />
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-16 bg-[#010101]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Find Your Perfect Court?
          </h2>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Join thousands of players who trust CourtConnect for
            their sports facility needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={() => navigate("/find-court")}
              className="bg-[#98e209] text-[#010101] hover:bg-[#89cb08] px-8 py-6 text-lg rounded-full"
            >
              Start Booking Now
            </Button>
            <Button
              onClick={() => navigate("/login")}
              className="bg-transparent text-white hover:bg-white hover:text-[#010101] px-8 py-6 text-lg rounded-full border-2 border-white"
            >
              Create Account
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}