import json
import logging
import httpx
from typing import Dict, Any, Optional
from app.config import settings
from app.core.logging import PLACES_API_CALLS
from app.core.rate_limit import get_cached_value, set_cached_value

logger = logging.getLogger("business_intel_api")

class GooglePlacesService:
    def __init__(self):
        self.places_key = settings.GOOGLE_PLACES_API_KEY
        
    def _map_new_place_to_legacy(self, p: Dict[str, Any]) -> Dict[str, Any]:
        """
        Translates a Google Places API (New) payload to the legacy schema expected by the application.
        """
        loc = p.get("location", {})
        hours = p.get("regularOpeningHours", {})
        types = [p.get("primaryType")] if p.get("primaryType") else ["business"]
        
        legacy_hours = None
        if hours:
            legacy_hours = {
                "open_now": hours.get("openNow"),
                "weekday_text": hours.get("weekdayDescriptions", [])
            }

        return {
            "place_id": p.get("id"),
            "name": p.get("displayName", {}).get("text"),
            "formatted_address": p.get("formattedAddress"),
            "geometry": {
                "location": {
                    "lat": loc.get("latitude"),
                    "lng": loc.get("longitude")
                }
            } if loc else None,
            "rating": p.get("rating"),
            "user_ratings_total": p.get("userRatingCount"),
            "formatted_phone_number": p.get("nationalPhoneNumber") or p.get("internationalPhoneNumber"),
            "website": p.get("websiteUri"),
            "types": types,
            "opening_hours": legacy_hours
        }

    async def text_search(self, query: str, page_token: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes a text search query using the Google Places API (New).
        """
        if not self.places_key:
            raise Exception("GOOGLE_PLACES_API_KEY is not configured in environment variables.")

        # 1. Check cache first
        cache_key = f"places_search_v1:{query.lower().strip()}:{page_token or ''}"
        cached = get_cached_value(cache_key)
        if cached:
            logger.info(f"[places] Search cache hit for '{query}'")
            return json.loads(cached)

        # 2. Query Google Places API (New)
        PLACES_API_CALLS.labels(type="search", status="success").inc()
        url = "https://places.googleapis.com/v1/places:searchText"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.places_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.primaryType,places.regularOpeningHours,nextPageToken"
        }
        
        body = {
            "textQuery": query
        }
        if page_token:
            body["pageToken"] = page_token
            
        async with httpx.AsyncClient(timeout=15.0) as client:
            res = await client.post(url, headers=headers, json=body)
            if res.status_code == 200:
                data = res.json()
                
                # Format to resemble legacy Places payload structure
                places_list = data.get("places", [])
                formatted_results = [self._map_new_place_to_legacy(p) for p in places_list]
                
                result = {
                    "results": formatted_results,
                    "next_page_token": data.get("nextPageToken"),
                    "status": "OK"
                }

                # Cache response for 24h
                set_cached_value(cache_key, json.dumps(result), expire_seconds=86400)
                return result
            else:
                logger.error(f"[places] Google API returned HTTP {res.status_code}: {res.text}")
                PLACES_API_CALLS.labels(type="search", status="error").inc()
                raise Exception(f"Google Places API query failed with status code {res.status_code}")

    async def get_place_details(self, place_id: str) -> Dict[str, Any]:
        """
        Retrieves place details using Google Places API (New) GET endpoint.
        """
        if not self.places_key:
            raise Exception("GOOGLE_PLACES_API_KEY is not configured.")

        # Check cache
        cache_key = f"place_details_v1:{place_id}"
        cached = get_cached_value(cache_key)
        if cached:
            logger.info(f"[places] Details cache hit for '{place_id}'")
            return json.loads(cached)
            
        PLACES_API_CALLS.labels(type="details", status="success").inc()
        
        url = f"https://places.googleapis.com/v1/places/{place_id}"
        headers = {
            "X-Goog-Api-Key": self.places_key,
            "X-Goog-FieldMask": "id,displayName,formattedAddress,location,rating,userRatingCount,nationalPhoneNumber,internationalPhoneNumber,websiteUri,primaryType,regularOpeningHours"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code == 200:
                data = res.json()
                result = self._map_new_place_to_legacy(data)
                
                # Cache for 24h
                set_cached_value(cache_key, json.dumps(result), expire_seconds=86400)
                return result
            else:
                PLACES_API_CALLS.labels(type="details", status="error").inc()
                logger.error(f"[places] Details API HTTP error: {res.text}")
                raise Exception(f"Place Details HTTP error: {res.status_code}")
        
    def get_photo_url(self, photo_reference: str) -> str:
        """
        Returns photo redirect URL for client viewing (places new photo fallback).
        """
        if self.places_key:
            return f"https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference={photo_reference}&key={self.places_key}"
        return "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=400"
        
google_places_service = GooglePlacesService()
