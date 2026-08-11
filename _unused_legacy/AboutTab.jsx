import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapPin, Star, Heart, AlertTriangle, Loader2, RefreshCw, ExternalLink } from "lucide-react";

export default function AboutTab({ trip }) {
  const [aboutInfo, setAboutInfo] = useState(trip.about_info || null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectedCity, setSelectedCity] = useState(trip.cities?.[0] || trip.country || "");

  useEffect(() => {
    if (trip.about_info) {
      setAboutInfo(trip.about_info);
    }
  }, [trip.about_info]);

  const generateAboutInfo = async () => {
    if (!selectedCity) return;
    setGenerating(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate comprehensive travel information for ${selectedCity}.
        
        Return ONLY valid JSON in this exact format:
        {
          "short_info": "Brief 2-3 sentence overview of this destination",
          "hot_spots": [
            {"name": "Place Name", "description": "1 sentence description", "link": "https://google.com/search?q=Place+Name"},
            {"name": "Another Place", "description": "1 sentence description", "link": "https://google.com/search?q=Another+Place"}
          ],
          "travel_recommendations": "Best time to visit, transportation tips, local customs (2-3 sentences)",
          "stay_recommendations": "Recommended neighborhoods or areas to stay (1-2 sentences)",
          "emergency_info": "Emergency phone numbers, embassy info, important contacts (2-3 sentences)"
        }

        Make it concise, practical, and easy to read. Include 3-5 hot spots with real names.`,
        response_json_schema: {
          type: "object",
          properties: {
            short_info: { type: "string" },
            hot_spots: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  description: { type: "string" },
                  link: { type: "string" }
                }
              }
            },
            travel_recommendations: { type: "string" },
            stay_recommendations: { type: "string" },
            emergency_info: { type: "string" }
          },
          required: ["short_info", "hot_spots", "travel_recommendations", "stay_recommendations", "emergency_info"]
        }
      });
      
      const updated = await base44.entities.Trip.update(trip.id, { about_info: response });
      setAboutInfo(response);
    } catch (error) {
      console.error("Failed to generate info:", error);
    }
    setGenerating(false);
  };

  const allLocations = [
    ...(trip.cities || []),
    trip.country
  ].filter(Boolean);

  if (!aboutInfo && !generating) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center font-body">
        <MapPin className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-foreground font-heading font-medium mb-1">No destination info yet</p>
        {allLocations.length > 1 ? (
          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">Select a city to generate info for:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {allLocations.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCity(loc)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCity === loc
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/70"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground mb-4">Generate comprehensive travel information for {allLocations[0] || "this destination"}</p>
        )}
        <button
          onClick={generateAboutInfo}
          disabled={!selectedCity}
          className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Star className="w-4 h-4" /> Generate Info
        </button>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center font-body">
        <Loader2 className="w-8 h-8 text-muted-foreground mx-auto mb-3 animate-spin" />
        <p className="text-foreground font-heading font-medium">Generating travel information...</p>
        <p className="text-sm text-muted-foreground mt-1">This may take a moment</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 font-body">
      {/* Short Info */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-heading font-medium text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4" /> About {selectedCity}
          </h3>
          <div className="flex items-center gap-2">
            {allLocations.length > 1 && (
              <select
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value);
                  setAboutInfo(null);
                }}
                className="text-xs bg-muted border border-input rounded-lg px-2 py-1 outline-none focus:border-ring"
              >
                {allLocations.map((loc, idx) => (
                  <option key={idx} value={loc}>{loc}</option>
                ))}
              </select>
            )}
            <button onClick={generateAboutInfo} className="text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-foreground text-sm leading-relaxed">{aboutInfo.short_info}</p>
      </div>

      {/* Hot Spots */}
      {aboutInfo.hot_spots && aboutInfo.hot_spots.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-heading font-medium text-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4" /> Hot Spots
          </h3>
          <div className="space-y-3">
            {aboutInfo.hot_spots.map((spot, idx) => (
              <a
                key={idx}
                href={spot.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block p-3 bg-muted rounded-xl hover:bg-secondary transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-heading font-medium text-foreground text-sm">{spot.name}</p>
                    {spot.description && <p className="text-xs text-muted-foreground mt-0.5">{spot.description}</p>}
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Travel Recommendations */}
      {aboutInfo.travel_recommendations && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-heading font-medium text-foreground mb-2 flex items-center gap-2">
            <Heart className="w-4 h-4" /> Travel Tips
          </h3>
          <p className="text-foreground text-sm leading-relaxed">{aboutInfo.travel_recommendations}</p>
        </div>
      )}

      {/* Stay Recommendations */}
      {aboutInfo.stay_recommendations && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-heading font-medium text-foreground mb-2 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Where to Stay
          </h3>
          <p className="text-foreground text-sm leading-relaxed">{aboutInfo.stay_recommendations}</p>
        </div>
      )}

      {/* Emergency Info */}
      {aboutInfo.emergency_info && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="text-sm font-heading font-medium text-amber-700 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Emergency Info
          </h3>
          <p className="text-amber-900 text-sm leading-relaxed">{aboutInfo.emergency_info}</p>
        </div>
      )}
    </div>
  );
}