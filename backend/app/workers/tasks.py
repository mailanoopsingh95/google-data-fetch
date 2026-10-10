import os
import csv
import json
import logging
from typing import List
from datetime import datetime
import pandas as pd
from celery import Celery
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import SyncSessionLocal
from app.db.models import Export, Search, Business, SearchResult, User
from app.services.google_places import google_places_service
from app.services.scraper import scraper
from app.services.ai_analyzer import ai_analyzer_service

logger = logging.getLogger("business_intel_api")

# Initialize Celery app (used in production with Redis)
celery_broker = settings.REDIS_URL or "redis://localhost:6379/0"
celery_app = Celery("tasks", broker=celery_broker, backend=celery_broker)

# Ensure exports directory exists
EXPORTS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "static", "exports"))
os.makedirs(EXPORTS_DIR, exist_ok=True)

def run_bulk_search(db: Session, user_id: str, export_id: str, queries: List[str]):
    """
    Executes bulk search query processing.
    Updates the export record status and writes final CSV/Excel/JSON files.
    """
    export_record = db.query(Export).filter(Export.id == export_id).first()
    if not export_record:
        logger.error(f"[worker] Export record {export_id} not found")
        return

    try:
        export_record.status = "PROCESSING"
        db.commit()

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise Exception("User not found")

        collected_businesses = []

        for q in queries:
            q_clean = q.strip()
            if not q_clean:
                continue

            logger.info(f"[worker] Processing query '{q_clean}' in bulk search")
            
            # 1. Create a Search history record
            search_record = Search(user_id=user_id, query=q_clean)
            db.add(search_record)
            db.commit()
            db.refresh(search_record)

            # 2. Places search (uses cache internally)
            search_res = google_places_service.text_search(q_clean)
            results = search_res.get("results", [])

            # Limit results per query in bulk searches to prevent rapid quota depletion
            results = results[:10]

            for r in results:
                place_id = r.get("place_id")
                if not place_id:
                    continue

                # 3. Check if business already exists in DB
                business = db.query(Business).filter(Business.place_id == place_id).first()
                
                if not business:
                    # Fetch details to obtain website
                    # Detailed fields
                    website = r.get("website")
                    phone = r.get("formatted_phone_number") or r.get("phone")
                    
                    # Crawl & Scraping
                    crawled_data = {}
                    if website:
                        try:
                            crawled_data = scraper.crawl_site(website)
                        except Exception as scrape_err:
                            logger.error(f"[worker] Error crawling {website}: {scrape_err}")

                    # AI Lead Enrichment
                    try:
                        ai_data = ai_analyzer_service.analyze_business(r, crawled_data)
                    except Exception as ai_err:
                        logger.error(f"[worker] Error analyzing business with AI: {ai_err}")
                        ai_data = ai_analyzer_service._heuristic_fallback(
                            r.get("name"), r.get("types", ["Business"])[0], website, phone, r.get("rating", 0.0), r.get("user_ratings_total", 0)
                        )

                    # Create new business record
                    business = Business(
                        place_id=place_id,
                        business_name=r.get("name"),
                        category=r.get("types", ["Business"])[0],
                        address=r.get("formatted_address"),
                        latitude=r.get("geometry", {}).get("location", {}).get("lat") if r.get("geometry") else None,
                        longitude=r.get("geometry", {}).get("location", {}).get("lng") if r.get("geometry") else None,
                        rating=r.get("rating"),
                        reviews_count=r.get("user_ratings_total") or 0,
                        phone=phone,
                        website=website,
                        opening_hours=r.get("opening_hours"),
                        
                        emails=crawled_data.get("emails", []),
                        phones=crawled_data.get("phones", []),
                        social_links=crawled_data.get("social_links", []),
                        contact_page=crawled_data.get("contact_page"),
                        about_summary=crawled_data.get("about_summary"),
                        tech_stack=crawled_data.get("tech_stack", []),
                        
                        lead_score=ai_data.get("lead_score"),
                        worth_contacting=ai_data.get("worth_contacting"),
                        estimated_size=ai_data.get("estimated_size"),
                        sales_opportunity_score=ai_data.get("sales_opportunity_score"),
                        raw_places_response=r,
                        crawled_at=datetime.utcnow()
                    )
                    db.add(business)
                    db.commit()
                    db.refresh(business)
                    
                    # Increment user quota
                    user.quota_used += 1
                    db.commit()

                # Link Search to Business
                link_exists = db.query(SearchResult).filter(
                    SearchResult.search_id == search_record.id,
                    SearchResult.business_id == business.id
                ).first()
                
                if not link_exists:
                    link = SearchResult(search_id=search_record.id, business_id=business.id)
                    db.add(link)
                    db.commit()

                collected_businesses.append(business)

        # 3. Generate export file
        file_url = generate_export_file(collected_businesses, export_id, export_record.export_type)
        
        export_record.status = "COMPLETED"
        export_record.download_url = file_url
        db.commit()
        logger.info(f"[worker] Bulk search completed. Export available at {file_url}")

    except Exception as e:
        db.rollback()
        export_record.status = "FAILED"
        db.commit()
        logger.error(f"[worker] Bulk search failed: {e}", exc_info=True)


def generate_export_file(businesses: List[Business], export_id: str, export_type: str) -> str:
    """Writes businesses data to disk in CSV, XLSX or JSON and returns API download URL."""
    rows = []
    for b in businesses:
        rows.append({
            "Business Name": b.business_name,
            "Category": b.category,
            "Address": b.address,
            "Rating": b.rating,
            "Reviews Count": b.reviews_count,
            "Phone Number": b.phone,
            "Website URL": b.website,
            "Email Address": ", ".join(b.emails) if b.emails else "",
            "Social Media Links": ", ".join(b.social_links) if b.social_links else "",
            "Contact Page URL": b.contact_page,
            "Tech Stack": ", ".join(b.tech_stack) if b.tech_stack else "",
            "Lead Score": b.lead_score,
            "Sales Opportunity Score": b.sales_opportunity_score,
            "Worth Contacting": b.worth_contacting,
            "Estimated Size": b.estimated_size,
            "About Summary": b.about_summary
        })

    filename = f"{export_id}.{export_type.lower()}"
    filepath = os.path.join(EXPORTS_DIR, filename)

    if export_type.upper() == "CSV":
        df = pd.DataFrame(rows)
        df.to_csv(filepath, index=False)
    elif export_type.upper() == "XLSX":
        df = pd.DataFrame(rows)
        df.to_excel(filepath, index=False, engine='openpyxl')
    elif export_type.upper() == "JSON":
        with open(filepath, "w") as f:
            json.dump(rows, f, indent=2)

    return f"/static/exports/{filename}"


# ============ Celery Task Wrappers ============

@celery_app.task(name="tasks.process_bulk_search")
def process_bulk_search_celery(user_id: str, export_id: str, queries: List[str]):
    """Celery task wrapper."""
    db = SyncSessionLocal()
    try:
        run_bulk_search(db, user_id, export_id, queries)
    finally:
        db.close()
