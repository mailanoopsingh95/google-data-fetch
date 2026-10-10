import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    subscription_plan = Column(String, default="free", nullable=False)  # free, starter, pro, enterprise
    subscription_status = Column(String, default="active", nullable=False)  # active, canceled
    stripe_customer_id = Column(String, nullable=True)
    stripe_subscription_id = Column(String, nullable=True)
    quota_used = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    api_keys = relationship("ApiKey", back_populates="user", cascade="all, delete-orphan")
    searches = relationship("Search", back_populates="user", cascade="all, delete-orphan")
    exports = relationship("Export", back_populates="user", cascade="all, delete-orphan")
    usage_logs = relationship("UsageLog", back_populates="user", cascade="all, delete-orphan")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    key_hash = Column(String, unique=True, index=True, nullable=False)
    prefix = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="api_keys")


class Search(Base):
    __tablename__ = "searches"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="searches")
    results = relationship("SearchResult", back_populates="search", cascade="all, delete-orphan")


class Business(Base):
    __tablename__ = "businesses"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    place_id = Column(String, unique=True, index=True, nullable=False)
    business_name = Column(String, nullable=False)
    category = Column(String, nullable=True)
    address = Column(String, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    rating = Column(Float, nullable=True)
    reviews_count = Column(Integer, default=0, nullable=False)
    phone = Column(String, nullable=True)
    website = Column(String, nullable=True)
    opening_hours = Column(JSON, nullable=True)
    
    # Enrichment fields
    emails = Column(JSON, default=list, nullable=True)
    phones = Column(JSON, default=list, nullable=True)
    social_links = Column(JSON, default=list, nullable=True)
    contact_page = Column(String, nullable=True)
    about_summary = Column(String, nullable=True)
    tech_stack = Column(JSON, default=list, nullable=True)
    
    # AI enrichment metrics
    lead_score = Column(Integer, nullable=True)
    worth_contacting = Column(Boolean, nullable=True)
    estimated_size = Column(String, nullable=True)
    sales_opportunity_score = Column(Integer, nullable=True)
    
    raw_places_response = Column(JSON, nullable=True)
    crawled_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    searches = relationship("SearchResult", back_populates="business", cascade="all, delete-orphan")


class SearchResult(Base):
    __tablename__ = "search_results"

    search_id = Column(String, ForeignKey("searches.id", ondelete="CASCADE"), primary_key=True)
    business_id = Column(String, ForeignKey("businesses.id", ondelete="CASCADE"), primary_key=True)

    search = relationship("Search", back_populates="results")
    business = relationship("Business", back_populates="searches")


class Export(Base):
    __tablename__ = "exports"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    export_type = Column(String, nullable=False)  # CSV, JSON, XLSX
    status = Column(String, default="PENDING", nullable=False)  # PENDING, COMPLETED, FAILED
    download_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="exports")


class UsageLog(Base):
    __tablename__ = "usage_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    api_key_id = Column(String, ForeignKey("api_keys.id", ondelete="SET NULL"), nullable=True)
    endpoint = Column(String, nullable=False)
    status_code = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="usage_logs")
