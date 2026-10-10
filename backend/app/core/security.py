import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Union
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

# CryptContext for password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload.get("sub")
    except JWTError:
        return None

def generate_api_key() -> str:
    """Generate a premium SerpApi-style live API key."""
    random_bytes = secrets.token_bytes(24)
    return f"bi_live_{hashlib.md5(random_bytes).hexdigest()}"

def hash_api_key(api_key: str) -> str:
    """Securely hash API key for DB storage."""
    return hashlib.sha256(api_key.encode()).hexdigest()
