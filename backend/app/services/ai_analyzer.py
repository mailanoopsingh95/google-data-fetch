import json
import logging
import httpx
from typing import Dict, Any, Optional
from app.config import settings
from app.core.logging import LLM_CALLS

logger = logging.getLogger("business_intel_api")

class AIAnalyzerService:
    def __init__(self):
        self.provider = settings.LLM_PROVIDER
        self.gemini_key = settings.GEMINI_API_KEY
        self.openai_key = settings.OPENAI_API_KEY
        self.ollama_host = settings.OLLAMA_HOST
        self.ollama_model = settings.OLLAMA_MODEL

    async def analyze_business(self, business_data: Dict[str, Any], crawled_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyzes business raw metadata and crawled website text to evaluate lead quality.
        Returns a standardized dict of insights.
        """
        name = business_data.get("name") or business_data.get("business_name") or "Unknown Business"
        category = business_data.get("category") or "Local Business"
        website = business_data.get("website") or ""
        phone = business_data.get("phone") or ""
        rating = business_data.get("rating") or 0.0
        reviews = business_data.get("reviews_count") or business_data.get("user_ratings_total") or 0
        
        emails = crawled_data.get("emails", [])
        techs = crawled_data.get("tech_stack", [])
        about = crawled_data.get("about_summary") or ""
        
        prompt = f"""
You are a sales intelligence AI. Analyze this company data and return a JSON object with lead qualification details.

Company Name: {name}
Primary Category: {category}
Website: {website}
Phone: {phone}
Google Rating: {rating} ({reviews} reviews)
Emails scraped: {', '.join(emails) if emails else 'None'}
Technologies detected: {', '.join(techs) if techs else 'None'}
Scraped Text Snippet: {about[:400]}

Your response MUST be a single, valid JSON object with the following keys and values:
{{
  "company_summary": "Concise 1-2 sentence description of what the company does based on category and scraped text.",
  "industry_classification": "Standardized industry name (e.g. Hospitality, Healthcare, IT Services, Retail, Manufacturing).",
  "lead_score": 1-100 integer (higher is better, score based on: website presence (+15), emails available (+20), good ratings (+15), has custom tech stack (+15)),
  "worth_contacting": true/false (true if lead_score >= 50 and they have a website/contact method),
  "estimated_size": "Small", "Medium", or "Large" (Small: <10 reviews/no website, Medium: 10-100 reviews or website, Large: >100 reviews or custom tech stack like Next.js/Shopify),
  "sales_opportunity_score": 1-100 integer representing the potential sales opportunity size (e.g. if they have no website but reviews exist, it is a high website design opportunity).
}}

Output ONLY the JSON object. Do not include markdown code block syntax (like ```json).
"""

        # 1. Attempt Gemini
        if self.provider == "gemini" and self.gemini_key:
            try:
                LLM_CALLS.labels(provider="gemini", status="success").inc()
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_key)
                # Use gemini-1.5-flash as the standard fast text model
                model = genai.GenerativeModel('gemini-1.5-flash')
                response = model.generate_content(prompt)
                parsed = self._clean_and_parse_json(response.text)
                if parsed:
                    return parsed
            except Exception as e:
                logger.error(f"[llm] Gemini API call failed: {e}")
                LLM_CALLS.labels(provider="gemini", status="error").inc()

        # 2. Attempt OpenAI
        if self.provider == "openai" and self.openai_key:
            try:
                LLM_CALLS.labels(provider="openai", status="success").inc()
                import openai
                client = openai.OpenAI(api_key=self.openai_key)
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"}
                )
                parsed = self._clean_and_parse_json(response.choices[0].message.content)
                if parsed:
                    return parsed
            except Exception as e:
                logger.error(f"[llm] OpenAI API call failed: {e}")
                LLM_CALLS.labels(provider="openai", status="error").inc()

        # 3. Attempt Ollama
        if self.provider == "ollama" and self.ollama_host:
            try:
                LLM_CALLS.labels(provider="ollama", status="success").inc()
                url = f"{self.ollama_host}/api/generate"
                async with httpx.AsyncClient(timeout=15.0) as client:
                    payload = {
                        "model": self.ollama_model,
                        "prompt": prompt,
                        "stream": False,
                        "format": "json"
                    }
                    res = await client.post(url, json=payload)
                    if res.status_code == 200:
                        raw_text = res.json().get("response", "")
                        parsed = self._clean_and_parse_json(raw_text)
                        if parsed:
                            return parsed
            except Exception as e:
                logger.error(f"[llm] Ollama local call failed: {e}")
                LLM_CALLS.labels(provider="ollama", status="error").inc()

        # 4. Heuristic Fallback
        logger.info(f"[llm] LLM processing failed or unavailable. Using heuristics for '{name}'")
        return self._heuristic_fallback(name, category, website, phone, rating, reviews)

    def _clean_and_parse_json(self, text: str) -> Optional[Dict[str, Any]]:
        try:
            # Strip markdown formatting if any
            clean_text = text.strip()
            if clean_text.startswith("```json"):
                clean_text = clean_text.split("```json")[1].split("```")[0].strip()
            elif clean_text.startswith("```"):
                clean_text = clean_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(clean_text)
            
            # Type correction/formatting checks
            return {
                "company_summary": str(data.get("company_summary", "")),
                "industry_classification": str(data.get("industry_classification", "Local Business")),
                "lead_score": int(data.get("lead_score", 50)),
                "worth_contacting": bool(data.get("worth_contacting", False)),
                "estimated_size": str(data.get("estimated_size", "Medium")),
                "sales_opportunity_score": int(data.get("sales_opportunity_score", 50))
            }
        except Exception as e:
            logger.warning(f"[llm] Failed to parse JSON response: {text}. Error: {e}")
            return None

    def _heuristic_fallback(self, name: str, category: str, website: str, phone: str, rating: float, reviews: int) -> Dict[str, Any]:
        score = 25
        if website:
            score += 25
        if phone:
            score += 15
        if rating >= 4.0:
            score += 15
        if reviews >= 20:
            score += 20
        
        score = max(5, min(98, score))
        worth = score >= 50 and bool(phone or website)
        
        size = "Small"
        if reviews > 150 or (website and reviews > 50):
            size = "Large"
        elif reviews > 20 or website:
            size = "Medium"

        # Opportunities: e.g. lower rating has high service opportunity; no website has high web development opportunity
        opp_score = 40
        if not website:
            opp_score += 40  # Web Design opportunity
        elif rating < 3.8:
            opp_score += 30  # Reputation Management opportunity
            
        opp_score = max(10, min(95, opp_score))

        return {
            "company_summary": f"{name} provides {category.lower()} services. Rating: {rating} stars.",
            "industry_classification": category,
            "lead_score": score,
            "worth_contacting": worth,
            "estimated_size": size,
            "sales_opportunity_score": opp_score
        }

ai_analyzer_service = AIAnalyzerService()
