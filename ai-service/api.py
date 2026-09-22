from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import pickle
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer, MinMaxScaler
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics.pairwise import cosine_similarity

# Load model on startup
print("Loading AI model...")
with open('recommender_model.pkl', 'rb') as f:
    model_data = pickle.load(f)
print("[OK] Model loaded successfully!")

class SmartRecommender:
    def __init__(self, df, features, mlb, scaler):
        self.df, self.features, self.mlb, self.scaler = df, features, mlb, scaler

    def get_smart_recommendation(self, loc="", sport="", price="", gym="", pool="", n=5):
        # Build the User Vector
        user_vec = pd.Series(0.0, index=self.features.columns)
        input_count = 0

        # Map Location (Fuzzy match)
        if loc:
            match = [c for c in self.features.columns if loc.lower() in c.lower() and "Area_" in c]
            if match:
                user_vec[match[0]] = 1.0
                input_count += 1

        # Map Sport (Exact match)
        if sport:
            match = [c for c in self.mlb.classes_ if sport.title() == c]
            if match:
                user_vec[match[0]] = 1.0
                input_count += 1

        # Map Gym/Pool
        if gym.lower() == 'yes':
            user_vec['Norm_Gym'] = 1.0
            input_count += 1
        if pool.lower() == 'yes':
            user_vec['Norm_Pool'] = 1.0
            input_count += 1

        # Map Price
        if price and str(price).strip() not in ['', '-']:
            try:
                scaled_p = self.scaler.transform([[float(price), 0, 0]])[0, 0]
                user_vec['Norm_Price'] = scaled_p
                input_count += 1
            except:
                pass

        # DECIDE MODEL BASED ON ENTRIES
        if input_count == 0:
            print("No preferences provided. Showing top general results...")
            return self.df.head(n), "None (Default View)"

        elif input_count == 1:
            print(f"Detected 1 requirement. Triggering KNN Model for precision...")
            knn = NearestNeighbors(n_neighbors=n, metric='euclidean')
            knn.fit(self.features)
            dists, indices = knn.kneighbors(user_vec.values.reshape(1, -1))
            res = self.df.iloc[indices[0]].copy()
            res['Match_Score_%'] = (1 / (1 + dists[0]) * 100).round(2)
            return res, "K-Nearest Neighbors (KNN)"

        else:
            print(f"Detected {input_count} requirements. Triggering Cosine Similarity Model for profile matching...")
            scores = cosine_similarity(user_vec.values.reshape(1, -1), self.features).flatten()
            top_idx = scores.argsort()[-n:][::-1]
            res = self.df.iloc[top_idx].copy()
            res['Match_Score_%'] = (scores[top_idx] * 100).round(2)
            return res, "Cosine Similarity"


# Create recommender instance
recommender = SmartRecommender(
    model_data['df'],
    model_data['features'],
    model_data['mlb'],
    model_data['scaler']
)

# Create FastAPI app
app = FastAPI(title="Court Connect AI Recommender")

# Enable CORS for your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {
        "status": "online",
        "message": "Court Connect AI Recommender API",
        "version": "1.0"
    }

@app.get("/api/recommend")
def get_recommendations(
    location: Optional[str] = "",
    sport: Optional[str] = "",
    price: Optional[str] = "",
    gym: Optional[str] = "",
    pool: Optional[str] = "",
    n: int = 12
):
    try:
        print(f"[API Request] location={location}, sport={sport}, price={price}, gym={gym}, pool={pool}, n={n}")
        
        results, model_used = recommender.get_smart_recommendation(
            loc=location,
            sport=sport,
            price=price,
            gym=gym,
            pool=pool,
            n=n
        )
        
        # Convert to JSON-friendly format
        recommendations_raw = results.to_dict('records')
        
        # Debug: print first record to see actual field names
        if recommendations_raw:
            print("[DEBUG] First record keys:", list(recommendations_raw[0].keys()))
            print("[DEBUG] First record:", recommendations_raw[0])
        
        # Transform to match frontend expectations
        recommendations = []
        for idx, rec in enumerate(recommendations_raw):
            # Extract values with exact field names from CSV
            facility_name = rec.get("Facility Name") or rec.get("name") or "Unknown Court"
            area_location = rec.get("Area / Location") or rec.get("location") or "Location not specified"
            sports_offered = rec.get("Sports Offered") or rec.get("sport") or ""
            price_num = rec.get("Price_Num", 0)
            exact_hours = rec.get("Exact Opening Hours") or rec.get("openHours") or "9:00 AM - 10:00 PM"
            
            # Build amenities array
            amenities_list = []
            if rec.get("Gym_Bit", 0):
                amenities_list.append("Gym")
            if rec.get("Pool_Bit", 0):
                amenities_list.append("Swimming Pool")
            amenities_list.extend(["Parking", "Changing Rooms"])  # Defaults
            
            transformed = {
                "id": idx + 1,
                "name": facility_name,
                "sport": sports_offered,
                "location": area_location,
                "rating": 4.5,
                "reviews": int(rec.get("reviewCount", 0)),
                "price": float(price_num) if price_num else 0,
                "currency": "PKR",
                "availability": "Available",
                "image": "/default-court.jpg",
                "amenities": amenities_list,  # Now an array!
                "distance": None,
                "openHours": exact_hours,
                "matchScore": float(rec.get("Match_Score_%", 0))
            }
            recommendations.append(transformed)
        
        print(f"[DEBUG] Transformed {len(recommendations)} recommendations")
        if recommendations:
            print(f"[DEBUG] First transformed:", recommendations[0])
        
        # Calculate filter count
        filter_count = sum([
            bool(location),
            bool(sport),
            bool(price),
            bool(gym.lower() == 'yes'),
            bool(pool.lower() == 'yes')
        ])
        
        print(f"[OK] Returning {len(recommendations)} recommendations using {model_used}")
        
        return {
            "success": True,
            "modelUsed": model_used,
            "filterCount": filter_count,
            "count": len(recommendations),
            "recommendations": recommendations
        }
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "recommendations": []
        }

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "model_loaded": True,
        "total_venues": len(model_data['df'])
    }
