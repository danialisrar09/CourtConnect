import React from 'react';
import { MapPin, Star, Heart, Clock, ArrowRight, Car, Wifi, Users, Zap, Coffee, Shield, Fan, Lock, ShowerHead } from 'lucide-react';

interface VenueCardProps {
  id: string;
  name: string;
  sport: string;
  location: string;
  rating: number;
  reviews: number;
  price: number;
  currency?: string;
  availability?: string;
  image: string;
  amenities?: string[];
  distance?: string;
  openHours?: string;
  onBookNow: () => void;
  showFavorite?: boolean;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
}

// ─── Curated Unsplash court images (sport-specific, verified working) ─────────
const SPORT_IMAGES: Record<string, string[]> = {
  tennis: [
    'https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=600&q=80&auto=format&fit=crop',
  ],
  football: [
    'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1587329310686-91414b8e3cb7?w=600&q=80&auto=format&fit=crop',
  ],
  basketball: [
    'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1519861531473-9200262188bf?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1504450758481-7338eba7524a?w=600&q=80&auto=format&fit=crop',
  ],
  badminton: [
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1611251135345-18c56206b863?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1599391398131-cd12dfc6e3a9?w=600&q=80&auto=format&fit=crop',
  ],
  cricket: [
    'https://images.unsplash.com/photo-1540747913346-19212a4b423e?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1578763363228-6e8428de69b2?w=600&q=80&auto=format&fit=crop',
  ],
  volleyball: [
    'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1544889779-dc6e9ae48cc4?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1598153346810-860daa814c4b?w=600&q=80&auto=format&fit=crop',
  ],
  swimming: [
    'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1560090995-01632a28895b?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1576610616656-d3aa5d1f4534?w=600&q=80&auto=format&fit=crop',
  ],
  gym: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=600&q=80&auto=format&fit=crop',
  ],
  padel: [
    'https://images.unsplash.com/photo-1707343844152-6d33a0bb32c3?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1617577963012-6ef0a4568dbb?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1687975261498-a44ef9bbba7f?w=600&q=80&auto=format&fit=crop',
  ],
  futsal: [
    'https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1631157769375-23b2f6bd6bf5?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1606925797300-0b35e9d1794e?w=600&q=80&auto=format&fit=crop',
  ],
  default: [
    'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1486218119243-13301ac4e501?w=600&q=80&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1505093332632-7a8a1e5e5bf6?w=600&q=80&auto=format&fit=crop',
  ],
};

/**
 * Pick a deterministic, sport-specific image for a court.
 * Same court name always gets the same image (no flicker on re-render).
 */
const getFallbackImage = (name: string, sport: string): string => {
  const key = `${name}${sport}`.toLowerCase();

  // Detect sport
  let bucket: string[] = SPORT_IMAGES.default;
  if (key.includes('tennis'))                           bucket = SPORT_IMAGES.tennis;
  else if (key.includes('football'))                    bucket = SPORT_IMAGES.football;
  else if (key.includes('futsal'))                      bucket = SPORT_IMAGES.futsal;
  else if (key.includes('basketball'))                  bucket = SPORT_IMAGES.basketball;
  else if (key.includes('badminton'))                   bucket = SPORT_IMAGES.badminton;
  else if (key.includes('cricket'))                     bucket = SPORT_IMAGES.cricket;
  else if (key.includes('volleyball'))                  bucket = SPORT_IMAGES.volleyball;
  else if (key.includes('swim') || key.includes('pool')) bucket = SPORT_IMAGES.swimming;
  else if (key.includes('gym') || key.includes('fitness')) bucket = SPORT_IMAGES.gym;
  else if (key.includes('padel'))                       bucket = SPORT_IMAGES.padel;

  // Deterministic pick within bucket using name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % bucket.length;
  return bucket[hash];
};

// ─── Amenity icon mapping ─────────────────────────────────────────────────────
const getAmenityIcon = (amenity: string) => {
  const n = amenity.toLowerCase();
  if (n.includes('parking') || n.includes('car'))       return <Car className="w-3 h-3" />;
  if (n.includes('wifi') || n.includes('wi-fi'))         return <Wifi className="w-3 h-3" />;
  if (n.includes('changing'))                            return <Users className="w-3 h-3" />;
  if (n.includes('shower'))                              return <ShowerHead className="w-3 h-3" />;
  if (n.includes('lockers'))                             return <Lock className="w-3 h-3" />;
  if (n.includes('equipment') || n.includes('rental'))   return <Users className="w-3 h-3" />;
  if (n.includes('lighting') || n.includes('light'))    return <Zap className="w-3 h-3" />;
  if (n.includes('air') || n.includes('ac'))             return <Fan className="w-3 h-3" />;
  if (n.includes('cafeteria') || n.includes('food'))     return <Coffee className="w-3 h-3" />;
  if (n.includes('security') || n.includes('cctv'))     return <Shield className="w-3 h-3" />;
  return <Star className="w-3 h-3" />;
};

/** Format a PKR price with thousands separator. e.g. 1500 → "1,500" */
const formatPKR = (price: number): string =>
  Math.round(price).toLocaleString('en-PK');

// ─── Component ────────────────────────────────────────────────────────────────
export const VenueCard: React.FC<VenueCardProps> = ({
  id,
  name,
  sport,
  location,
  rating,
  reviews,
  price,
  currency = 'Rs',
  availability = 'Available',
  image,
  amenities = [],
  distance,
  openHours,
  onBookNow,
  showFavorite = false,
  isFavorite = false,
  onFavoriteToggle,
}) => {
  const displayAmenities = amenities.slice(0, 3);
  const fallbackImage = getFallbackImage(name, sport);
  
  // Ignore generated grey placeholders from the seed script
  const isPlaceholder = image && (image.includes('placehold.co') || image.includes('via.placeholder.com') || image.includes('placeholder'));
  // Always show image — primary if valid and not a placeholder, fallback otherwise
  const imgSrc = (image && image.startsWith('http') && !isPlaceholder) ? image : fallbackImage;

  return (
    <div className="find-court-card">
      {/* ── Image ──────────────────────────────────────────────────────────── */}
      <div className="find-court-card-image-container">
        <img
          src={imgSrc}
          alt={name}
          className="find-court-card-image"
          loading="lazy"
          onError={(e) => {
            if (e.currentTarget.src !== fallbackImage) {
              e.currentTarget.src = fallbackImage;
            }
          }}
        />

        {/* Sport Badge */}
        <div className="find-court-sport-badge">{sport}</div>

        {/* Favorite Button */}
        {showFavorite && (
          <button
            className="find-court-favorite-btn"
            onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(); }}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart className={isFavorite ? 'fill-current' : ''} />
          </button>
        )}
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="find-court-card-content">
        <h3 className="find-court-card-title">{name}</h3>

        <div className="find-court-location">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="find-court-location-text">{location || 'Location not specified'}</span>
        </div>

        {/* Rating & Distance */}
        <div className="find-court-meta-row">
          <div className="find-court-rating">
            <Star className="w-4 h-4 fill-current" />
            <span className="find-court-rating-value">
              {rating > 0 ? rating.toFixed(1) : 'New'}
            </span>
            {reviews > 0 && (
              <span className="find-court-reviews">({reviews})</span>
            )}
          </div>
          {distance && <span className="find-court-distance">{distance}</span>}
        </div>

        {/* Amenities */}
        {displayAmenities.length > 0 && (
          <div className="find-court-amenities">
            {displayAmenities.map((amenity, i) => (
              <div key={i} className="find-court-amenity-tag">
                {getAmenityIcon(amenity)}
                <span>{amenity}</span>
              </div>
            ))}
            {amenities.length > 3 && (
              <div className="find-court-amenity-tag">+{amenities.length - 3}</div>
            )}
          </div>
        )}

        <div className="find-court-spacer" />

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="find-court-footer">
          <div className="find-court-price-row">
            <div className="find-court-price-container">
              <span className="find-court-price-label">From</span>
              <div>
                <span className="find-court-price">Rs {formatPKR(price)}</span>
                <span className="find-court-price-per">/hr</span>
              </div>
            </div>
            <div className="find-court-availability">
              <Clock className="w-3 h-3" />
              <span>{availability}</span>
            </div>
          </div>

          <button
            className="find-court-book-btn rounded-full"
            onClick={(e) => { e.stopPropagation(); onBookNow(); }}
          >
            <span>Book Now</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};