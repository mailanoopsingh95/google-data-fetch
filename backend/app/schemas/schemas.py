from typing import List, Optional, Any, Dict
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime

# ============ Auth & User Schemas ============
class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: str
    subscription_plan: str
    subscription_status: str
    quota_used: int
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class TokenPayload(BaseModel):
    sub: Optional[str] = None

# ============ API Key Schemas ============
class ApiKeyCreate(BaseModel):
    name: str

class ApiKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ApiKeyReveal(ApiKeyResponse):
    key: str  # Only returned once on creation

# ============ Business Schemas ============
class BusinessBase(BaseModel):
    place_id: str
    business_name: str
    category: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rating: Optional[float] = None
    reviews_count: int = 0
    phone: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[Any] = None

class BusinessEnrichment(BaseModel):
    emails: List[str] = []
    phones: List[str] = []
    social_links: List[str] = []
    contact_page: Optional[str] = None
    about_summary: Optional[str] = None
    tech_stack: List[str] = []

class BusinessAIAnalysis(BaseModel):
    lead_score: Optional[int] = None
    worth_contacting: Optional[bool] = None
    estimated_size: Optional[str] = None
    sales_opportunity_score: Optional[int] = None

class BusinessResponse(BusinessBase, BusinessEnrichment, BusinessAIAnalysis):
    id: str
    raw_places_response: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# ============ Search Schemas ============
class SearchRequest(BaseModel):
    query: str
    limit: Optional[int] = Field(default=10, ge=1, le=100)

class SearchResponse(BaseModel):
    id: str
    query: str
    created_at: datetime
    results: List[BusinessResponse] = []

    class Config:
        from_attributes = True

class BulkSearchUploadResponse(BaseModel):
    message: str
    export_id: str

# ============ Export Schemas ============
class ExportResponse(BaseModel):
    id: str
    export_type: str
    status: str
    download_url: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# ============ Analytics & Dashboard Schemas ============
class UsageStatsResponse(BaseModel):
    quota_limit: int
    quota_used: int
    total_searches: int
    total_keys: int
    daily_usage: List[Dict[str, Any]]  # [{"date": "2026-07-01", "count": 12}]
    lead_score_distribution: List[Dict[str, Any]]  # [{"range": "90-100", "count": 5}]

# ============ Google Sheets Sync Schemas ============
class GoogleSheetsSyncRequest(BaseModel):
    place_ids: List[str]
    mode: str  # "new" or "existing"
    spreadsheet_name: Optional[str] = None
    spreadsheet_id: Optional[str] = None
    worksheet_name: Optional[str] = None
    create_worksheet: Optional[bool] = False

class GoogleSheetsSyncResponse(BaseModel):
    success: bool
    spreadsheet_url: str
    message: str

