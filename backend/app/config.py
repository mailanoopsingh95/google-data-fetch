import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Business Intel API"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql://postgres@localhost:5432/dealers"
    
    # Redis Cache & Queue
    REDIS_URL: Optional[str] = "redis://localhost:6379/0"
    
    # Security
    JWT_SECRET: str = "991b3b97037474c165b5d610dad4320b5f596bb7982868dfd6747b85b7116b13"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # External APIs
    GOOGLE_PLACES_API_KEY: Optional[str] = None
    GOOGLE_SERVICE_ACCOUNT_INFO: Optional[str] = None
    
    # AI Providers
    LLM_PROVIDER: str = "gemini"  # "gemini", "openai", "ollama"
    GEMINI_API_KEY: Optional[str] = "AQ.Ab8RN6If9bR_d0Ya6Bodg3cwG9wh9iEo9WpbZrfLJfIv2l6Plw"
    OPENAI_API_KEY: Optional[str] = None
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"
    
    # Billing
    MOCK_BILLING: bool = True
    STRIPE_API_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    RAZORPAY_KEY_ID: Optional[str] = None
    RAZORPAY_KEY_SECRET: Optional[str] = None
    
    @property
    def sync_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql+asyncpg://", "postgresql://", 1)
        return url
        
    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    class Config:
        env_file = [".env.local", "../.env.local"]
        extra = "ignore"

settings = Settings()
