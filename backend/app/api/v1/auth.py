from typing import List
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.db.session import get_db
from app.db.models import User, ApiKey
from app.schemas.schemas import UserCreate, UserResponse, Token, ApiKeyCreate, ApiKeyResponse, ApiKeyReveal
from app.core.security import verify_password, get_password_hash, create_access_token, generate_api_key, hash_api_key
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    """Registers a new developer user account."""
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
        
    hashed_pwd = get_password_hash(user_in.password)
    user = User(
        name=user_in.name,
        email=user_in.email,
        hashed_password=hashed_pwd,
        subscription_plan="free",
        subscription_status="active"
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    """Logs in an existing user and returns a JWT access token."""
    # OAuth2PasswordBearer uses 'username', which represents the user email in our case
    result = await db.execute(select(User).where(User.email == username))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
        
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns the profile of the currently logged-in user."""
    return current_user

# ============ API Key Endpoints ============

@router.post("/keys", response_model=ApiKeyReveal)
async def generate_key(key_in: ApiKeyCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Generates a new developer API key."""
    raw_key = generate_api_key()
    hashed_key = hash_api_key(raw_key)
    prefix = raw_key[:12] + "..."  # bi_live_xxxx...
    
    api_key = ApiKey(
        user_id=current_user.id,
        name=key_in.name,
        key_hash=hashed_key,
        prefix=prefix,
        is_active=True
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    # Wrap in reveal schema with raw key (returned only once)
    return ApiKeyReveal(
        id=api_key.id,
        name=api_key.name,
        prefix=api_key.prefix,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        key=raw_key
    )

@router.get("/keys", response_model=List[ApiKeyResponse])
async def list_keys(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Lists all active API keys for the current user."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id, ApiKey.is_active == True)
        .order_by(ApiKey.created_at.desc())
    )
    return result.scalars().all()

@router.delete("/keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_key(key_id: str, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Revokes (deactivates) an API key."""
    result = await db.execute(
        select(ApiKey)
        .where(ApiKey.id == key_id, ApiKey.user_id == current_user.id)
    )
    api_key = result.scalars().first()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API Key not found or does not belong to user"
        )
        
    api_key.is_active = False
    await db.commit()
    return
