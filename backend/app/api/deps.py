import hashlib
from typing import Optional
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import APIKeyHeader, OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.config import settings
from app.db.session import get_db
from app.db.models import User, ApiKey
from app.core.security import decode_access_token, hash_api_key

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to validate JWT access token and return the authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        raise credentials_exception
        
    user_id = decode_access_token(token)
    if not user_id:
        raise credentials_exception
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise credentials_exception
        
    return user

async def verify_api_key(
    api_key: Optional[str] = Depends(api_key_header),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Dependency to authenticate external API calls using the X-API-Key header."""
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API Key missing. Provide a valid 'X-API-Key' header."
        )

    # Hash incoming key
    hashed_key = hash_api_key(api_key)
    
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.key_hash == hashed_key, ApiKey.is_active == True)
    )
    key_record = result.scalars().first()
    if not key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked API key"
        )
        
    # Get associated user
    user_result = await db.execute(select(User).where(User.id == key_record.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with this key not found"
        )
        
    # Inject api_key_id onto user object temporarily for logging
    user.current_api_key_id = key_record.id
    return user
