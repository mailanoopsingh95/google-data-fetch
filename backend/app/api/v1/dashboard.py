import logging
from typing import List, Dict, Any
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, desc

from app.db.session import get_db, SyncSessionLocal
from app.db.models import User, Search, Business, SearchResult, Export, ApiKey, UsageLog
from app.schemas.schemas import UsageStatsResponse, ExportResponse, BusinessResponse, GoogleSheetsSyncRequest, GoogleSheetsSyncResponse
from app.api.deps import get_current_user
from app.services.billing import billing_service
from app.workers.tasks import generate_export_file
from app.services.google_sheets import google_sheets_service

logger = logging.getLogger("business_intel_api")
router = APIRouter()

@router.get("/stats", response_model=UsageStatsResponse)
async def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns data analytics for the dashboard: quota usage, daily request logs,
    and business lead scoring breakdown.
    """
    # 1. Basic counts
    limit = billing_service.get_limit(current_user.subscription_plan)
    
    # Total searches
    s_count = await db.execute(select(func.count(Search.id)).where(Search.user_id == current_user.id))
    total_searches = s_count.scalar() or 0
    
    # Active keys
    k_count = await db.execute(select(func.count(ApiKey.id)).where(ApiKey.user_id == current_user.id, ApiKey.is_active == True))
    total_keys = k_count.scalar() or 0

    # 2. Daily usage (last 7 days of search queries)
    daily_usage = []
    today = datetime.utcnow().date()
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_start = datetime.combine(day, datetime.min.time())
        day_end = datetime.combine(day, datetime.max.time())
        
        day_count = await db.execute(
            select(func.count(Search.id))
            .where(Search.user_id == current_user.id, Search.created_at.between(day_start, day_end))
        )
        count = day_count.scalar() or 0
        daily_usage.append({
            "date": day.strftime("%b %d"),
            "count": count
        })

    # 3. Lead score distribution of searched leads
    # Query all businesses linked to user's searches
    businesses_query = (
        select(Business.lead_score)
        .join(SearchResult, SearchResult.business_id == Business.id)
        .join(Search, Search.id == SearchResult.search_id)
        .where(Search.user_id == current_user.id)
    )
    b_res = await db.execute(businesses_query)
    scores = [s[0] for s in b_res.all() if s[0] is not None]

    score_ranges = {
        "90-100 (Hot)": 0,
        "70-89 (Warm)": 0,
        "50-69 (Cool)": 0,
        "<50 (Cold)": 0
    }
    for s in scores:
        if s >= 90:
            score_ranges["90-100 (Hot)"] += 1
        elif s >= 70:
            score_ranges["70-89 (Warm)"] += 1
        elif s >= 50:
            score_ranges["50-69 (Cool)"] += 1
        else:
            score_ranges["<50 (Cold)"] += 1

    lead_score_distribution = [{"range": k, "count": v} for k, v in score_ranges.items()]

    return {
        "quota_limit": limit,
        "quota_used": current_user.quota_used,
        "total_searches": total_searches,
        "total_keys": total_keys,
        "daily_usage": daily_usage,
        "lead_score_distribution": lead_score_distribution
    }


@router.get("/history")
async def get_search_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns past searches for the logged-in user."""
    result = await db.execute(
        select(Search)
        .where(Search.user_id == current_user.id)
        .order_by(Search.created_at.desc())
    )
    return result.scalars().all()


@router.get("/leads", response_model=List[BusinessResponse])
async def get_user_leads(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Returns all enriched businesses that the user has searched."""
    query = (
        select(Business)
        .join(SearchResult, SearchResult.business_id == Business.id)
        .join(Search, Search.id == SearchResult.search_id)
        .where(Search.user_id == current_user.id)
        .order_by(Business.created_at.desc())
    )
    result = await db.execute(query)
    # Deduplicate in case same business was found in multiple searches
    businesses = {}
    for b in result.scalars().all():
        businesses[b.id] = b
    return list(businesses.values())


# ============ Export Endpoints ============

@router.get("/exports", response_model=List[ExportResponse])
async def list_exports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Lists all bulk search and business export jobs."""
    result = await db.execute(
        select(Export)
        .where(Export.user_id == current_user.id)
        .order_by(Export.created_at.desc())
    )
    return result.scalars().all()


@router.post("/exports", response_model=ExportResponse)
async def request_leads_export(
    place_ids: List[str] = Body(...),
    export_format: str = Query("CSV", description="CSV, XLSX, or JSON"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Triggers a synchronous export of specific business records by place ID."""
    if not place_ids:
        raise HTTPException(status_code=400, detail="Must provide at least one place_id")

    # Create Export record
    export = Export(
        user_id=current_user.id,
        export_type=export_format.upper(),
        status="PENDING"
    )
    db.add(export)
    await db.commit()
    await db.refresh(export)

    # Fetch corresponding businesses
    result = await db.execute(select(Business).where(Business.place_id.in_(place_ids)))
    businesses = result.scalars().all()
    
    if not businesses:
        export.status = "FAILED"
        await db.commit()
        raise HTTPException(status_code=400, detail="No matching businesses found for place_ids")

    # Run file generation synchronously
    file_url = generate_export_file(businesses, export.id, export.export_type)
    export.status = "COMPLETED"
    export.download_url = file_url
    await db.commit()
    await db.refresh(export)

    return export


def run_file_export_background(businesses: List[Business], export_id: str, export_type: str):
    """Helper method to run export file generation on thread pool."""
    sync_db = SyncSessionLocal()
    try:
        file_url = generate_export_file(businesses, export_id, export_type)
        export_record = sync_db.query(Export).filter(Export.id == export_id).first()
        if export_record:
            export_record.status = "COMPLETED"
            export_record.download_url = file_url
            sync_db.commit()
    except Exception as e:
        logger.error(f"[dashboard] Export generation failed: {e}")
        export_record = sync_db.query(Export).filter(Export.id == export_id).first()
        if export_record:
            export_record.status = "FAILED"
            sync_db.commit()
    finally:
        sync_db.close()


@router.get("/exports/google-sheets/client-email")
async def get_google_sheets_client_email(
    current_user: User = Depends(get_current_user)
):
    """Returns the client email of the Service Account for Google Sheets sharing."""
    return {
        "client_email": google_sheets_service.client_email or "mock-sheets-sync@sales-platform.iam.gserviceaccount.com"
    }


@router.post("/exports/google-sheets", response_model=GoogleSheetsSyncResponse)
async def sync_leads_to_google_sheets(
    payload: GoogleSheetsSyncRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Syncs selected leads directly to a Google Sheet."""
    if not payload.place_ids:
        raise HTTPException(status_code=400, detail="Must provide at least one place_id")

    # Fetch corresponding businesses
    result = await db.execute(select(Business).where(Business.place_id.in_(payload.place_ids)))
    businesses = result.scalars().all()
    
    if not businesses:
        raise HTTPException(status_code=400, detail="No matching businesses found for place_ids")

    try:
        url, message = google_sheets_service.export_leads(
            leads=businesses,
            mode=payload.mode,
            user_email=current_user.email,
            spreadsheet_name=payload.spreadsheet_name,
            spreadsheet_id=payload.spreadsheet_id,
            worksheet_name=payload.worksheet_name,
            create_worksheet=payload.create_worksheet
        )
        return {
            "success": True,
            "spreadsheet_url": url,
            "message": message
        }
    except Exception as err:
        logger.error(f"[dashboard] Google Sheets sync failed: {err}")
        raise HTTPException(status_code=500, detail=str(err))


@router.get("/exports/google-sheets/tabs")
async def get_google_sheets_tabs(
    spreadsheet_id: str = Query(..., description="Spreadsheet URL or ID to load tabs from"),
    current_user: User = Depends(get_current_user)
):
    """Fetches list of tabs (worksheets) inside a specific Google Sheet."""
    clean_id = google_sheets_service.extract_spreadsheet_id(spreadsheet_id)
    if not clean_id:
        raise HTTPException(status_code=400, detail="Invalid spreadsheet URL or ID format.")

    if not google_sheets_service.is_live:
        return {
            "tabs": ["Sheet1", "Leads", "Sync-Data"]
        }

    try:
        from googleapiclient.discovery import build
        sheets_service = build("sheets", "v4", credentials=google_sheets_service.creds)
        metadata = sheets_service.spreadsheets().get(spreadsheetId=clean_id).execute()
        sheets = metadata.get('sheets', [])
        tabs = [s['properties']['title'] for s in sheets]
        return {"tabs": tabs}
    except Exception as err:
        logger.error(f"[dashboard] Failed to load worksheets metadata for {clean_id}: {err}")
        raise HTTPException(
            status_code=400,
            detail=f"Could not load sheets list. Please verify that you shared Editor access with the Service Account email."
        )

