import csv
import logging
import asyncio
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Session

from app.db.session import get_db, SyncSessionLocal
from app.db.models import User, Search, Business, SearchResult, Export, UsageLog
from app.schemas.schemas import SearchRequest, SearchResponse, BusinessResponse, BulkSearchUploadResponse
from app.services.google_places import google_places_service
from app.services.scraper import scraper
from app.services.ai_analyzer import ai_analyzer_service
from app.services.billing import billing_service
from app.core.rate_limit import check_rate_limit
from app.api.deps import get_current_user, verify_api_key
from app.workers.tasks import process_bulk_search_celery, run_bulk_search

logger = logging.getLogger("business_intel_api")
router = APIRouter()

async def execute_enrichment_search(
    query: str,
    limit: int,
    user: User,
    db: AsyncSession,
    api_key_id: Optional[str] = None
) -> List[Business]:
    """Helper method to run Search + Crawling + AI lead scoring."""
    # 1. Add Search record
    search = Search(user_id=user.id, query=query)
    db.add(search)
    await db.commit()
    await db.refresh(search)

    # 3. Google Places API query
    try:
        search_res = await google_places_service.text_search(query)
    except Exception as e:
        logger.error(f"[search] Search API error: {e}")
        raise HTTPException(status_code=502, detail=f"Google Places Search error: {str(e)}")

    seen_places = set()
    deduped_results = []
    for r in search_res.get("results", []):
        place_id = r.get("place_id")
        if place_id and place_id not in seen_places:
            seen_places.add(place_id)
            deduped_results.append(r)
    raw_results = deduped_results[:limit]

    
    # 4. Check database for existing businesses to avoid duplicate scraping
    places_to_enrich = []
    place_id_map = {}
    
    for r in raw_results:
        place_id = r.get("place_id")
        if not place_id:
            continue
        
        b_result = await db.execute(select(Business).where(Business.place_id == place_id))
        business = b_result.scalars().first()
        
        if business:
            place_id_map[place_id] = business
        else:
            places_to_enrich.append(r)

    # 5. Network Crawl (Parallel)
    async def safe_crawl(website: Optional[str]) -> dict:
        if not website:
            return {}
        try:
            return await scraper.crawl_site(website)
        except Exception as crawl_err:
            logger.error(f"[search] Crawl failed for {website}: {crawl_err}")
            return {}

    crawl_tasks = [safe_crawl(r.get("website")) for r in places_to_enrich]
    crawled_list = await asyncio.gather(*crawl_tasks)

    # 6. AI Analysis (Parallel)
    async def safe_analyze(r: dict, crawled: dict) -> dict:
        try:
            return await ai_analyzer_service.analyze_business(r, crawled)
        except Exception as ai_err:
            logger.error(f"[search] AI analysis failed: {ai_err}")
            phone = r.get("formatted_phone_number") or r.get("phone")
            return ai_analyzer_service._heuristic_fallback(
                r.get("name"), r.get("types", ["Business"])[0], r.get("website"), phone, r.get("rating", 0.0), r.get("user_ratings_total", 0)
            )

    ai_tasks = [safe_analyze(places_to_enrich[i], crawled_list[i]) for i in range(len(places_to_enrich))]
    ai_list = await asyncio.gather(*ai_tasks)

    # 7. Database Write & Quota Deductions (Sequential for SQLAlchemy safety)
    for i, r in enumerate(places_to_enrich):
        crawled = crawled_list[i]
        ai_data = ai_list[i]
        place_id = r.get("place_id")
        
        # Check again to prevent duplicate key race condition from parallel execution
        check_again = await db.execute(select(Business).where(Business.place_id == place_id))
        existing_business = check_again.scalars().first()
        if existing_business:
            place_id_map[place_id] = existing_business
            continue

        phone = r.get("formatted_phone_number") or r.get("phone")
        website = r.get("website")

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
            
            emails=crawled.get("emails", []),
            phones=crawled.get("phones", []),
            social_links=crawled.get("social_links", []),
            contact_page=crawled.get("contact_page"),
            about_summary=crawled.get("about_summary"),
            tech_stack=crawled.get("tech_stack", []),
            
            lead_score=ai_data.get("lead_score"),
            worth_contacting=ai_data.get("worth_contacting"),
            estimated_size=ai_data.get("estimated_size"),
            sales_opportunity_score=ai_data.get("sales_opportunity_score"),
            raw_places_response=r,
            crawled_at=datetime.utcnow()
        )
        db.add(business)
        await db.commit()
        await db.refresh(business)

        # Deduct monthly search quota
        user.quota_used += 1
        await db.commit()

        place_id_map[place_id] = business

    # 8. Link searches to results and compile final list (Sequential)
    final_businesses = []
    for r in raw_results:
        place_id = r.get("place_id")
        business = place_id_map.get(place_id)
        if not business:
            continue

        link_result = await db.execute(
            select(SearchResult).where(
                SearchResult.search_id == search.id,
                SearchResult.business_id == business.id
            )
        )
        if not link_result.scalars().first():
            link = SearchResult(search_id=search.id, business_id=business.id)
            db.add(link)
            await db.commit()

        final_businesses.append(business)

    return final_businesses


# ============ Public Developer Search API ============

@router.get("/business/search", response_model=List[BusinessResponse])
async def public_developer_search(
    query: str = Query(..., description="Business search query"),
    limit: int = Query(10, ge=1, le=50, description="Max results to return"),
    api_user: User = Depends(verify_api_key),
    db: AsyncSession = Depends(get_db)
):
    """
    Public API key-authenticated endpoint for searching and enriching businesses.
    Enforces rate limits and plan quotas.
    """
    # 1. Rate Limit Check (60 reqs/min for API Keys)
    if not check_rate_limit(f"apikey_{api_user.id}", limit=60, window=60):
        # Log failed attempt
        log = UsageLog(user_id=api_user.id, api_key_id=api_user.current_api_key_id, endpoint="/api/v1/business/search", status_code=429)
        db.add(log)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Maximum 60 requests per minute."
        )

    try:
        results = await execute_enrichment_search(query, limit, api_user, db, api_user.current_api_key_id)
        
        # Log successful request
        log = UsageLog(user_id=api_user.id, api_key_id=api_user.current_api_key_id, endpoint="/api/v1/business/search", status_code=200)
        db.add(log)
        await db.commit()
        
        return results
    except HTTPException as http_err:
        log = UsageLog(user_id=api_user.id, api_key_id=api_user.current_api_key_id, endpoint="/api/v1/business/search", status_code=http_err.status_code)
        db.add(log)
        await db.commit()
        raise http_err
    except Exception as e:
        log = UsageLog(user_id=api_user.id, api_key_id=api_user.current_api_key_id, endpoint="/api/v1/business/search", status_code=500)
        db.add(log)
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))


# ============ Dashboard Panel Search API ============

@router.post("/search", response_model=SearchResponse)
async def dashboard_search(
    req: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Dashboard endpoint for business searches."""
    # Rate limit check (30 reqs/min for dashboard UI searches)
    if not check_rate_limit(f"user_{current_user.id}", limit=30, window=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Dashboard rate limit reached (30 queries/minute)."
        )

    businesses = await execute_enrichment_search(req.query, req.limit, current_user, db)
    
    # Generate search record to return
    result = await db.execute(
        select(Search).where(Search.user_id == current_user.id).order_by(Search.created_at.desc()).limit(1)
    )
    search_record = result.scalars().first()
    
    return SearchResponse(
        id=search_record.id,
        query=search_record.query,
        created_at=search_record.created_at,
        results=businesses
    )


# ============ Bulk CSV Search API ============

@router.post("/search/bulk", response_model=BulkSearchUploadResponse)
async def upload_bulk_search(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    export_format: str = Query("CSV", description="Format to export results: CSV, XLSX, JSON"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Accepts a CSV upload containing queries (one per line) and executes searches asynchronously.
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    # Read queries from CSV
    contents = await file.read()
    decoded = contents.decode("utf-8").splitlines()
    reader = csv.reader(decoded)
    
    queries = []
    for row in reader:
        if row:
            queries.append(row[0])

    if not queries:
        raise HTTPException(status_code=400, detail="The uploaded CSV file is empty")

    # Limit total queries to protect resources
    max_queries = 20
    if current_user.subscription_plan == "pro":
        max_queries = 100
    elif current_user.subscription_plan == "enterprise":
        max_queries = 500
        
    if len(queries) > max_queries:
        queries = queries[:max_queries]
        logger.warning(f"[search] Bulk upload truncated to {max_queries} queries for user {current_user.id}")

    # Create Export record
    export = Export(
        user_id=current_user.id,
        export_type=export_format.upper(),
        status="PENDING"
    )
    db.add(export)
    await db.commit()
    await db.refresh(export)

    # Launch Celery worker task or fallback to FastAPI background tasks
    # We try to use Celery if Redis is configured, else fallback immediately
    redis_available = settings.REDIS_URL is not None
    if redis_available:
        try:
            process_bulk_search_celery.delay(current_user.id, export.id, queries)
            logger.info(f"[search] Queued bulk search {export.id} via Celery")
        except Exception as e:
            logger.warning(f"[search] Failed to delegate to Celery, running via background task: {e}")
            background_tasks.add_task(run_background_sync, current_user.id, export.id, queries)
    else:
        background_tasks.add_task(run_background_sync, current_user.id, export.id, queries)
        logger.info(f"[search] Running bulk search {export.id} via local background task fallback")

    return {
        "message": f"Successfully queued {len(queries)} search queries. Track progress in exports.",
        "export_id": export.id
    }


def run_background_sync(user_id: str, export_id: str, queries: List[str]):
    """Wrapper function to invoke tasks synchronously inside a background task thread."""
    sync_db = SyncSessionLocal()
    try:
        run_bulk_search(sync_db, user_id, export_id, queries)
    finally:
        sync_db.close()
