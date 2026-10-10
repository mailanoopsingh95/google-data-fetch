import time
import logging
from typing import Optional
import redis
from fastapi import HTTPException, status
from app.config import settings

logger = logging.getLogger("business_intel_api")

# Initialize Redis client
redis_client: Optional[redis.Redis] = None
if settings.REDIS_URL:
    try:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        redis_client.ping()
        logger.info("[cache] Redis connection established for caching and rate limiting")
    except Exception as e:
        logger.warning(f"[cache] Failed to connect to Redis: {e}. Caching and rate limiting will fall back to local storage / DB.")
        redis_client = None

# Local in-memory store for rate limiting fallback
_in_memory_rate_limit = {}

def check_rate_limit(identifier: str, limit: int = 60, window: int = 60) -> bool:
    """
    Checks if the identifier has exceeded the rate limit.
    Returns True if allowed (within limit), False if rate-limited (exceeded).
    """
    now = time.time()
    bucket = int(now // window)
    
    if redis_client:
        try:
            key = f"rate_limit:{identifier}:{bucket}"
            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window * 2)
            results = pipe.execute()
            count = results[0]
            if count > limit:
                return False
            return True
        except Exception as e:
            logger.warning(f"[rate_limit] Redis command failed, falling back to memory: {e}")

    # Fallback to local memory rate limiting
    key = f"{identifier}:{bucket}"
    
    # Simple clean up of old buckets
    if len(_in_memory_rate_limit) > 5000:
        # Clear buckets older than 2 windows
        stale_threshold = bucket - 2
        keys_to_delete = [k for k in _in_memory_rate_limit.keys() if int(k.split(":")[-1]) < stale_threshold]
        for k in keys_to_delete:
            _in_memory_rate_limit.pop(k, None)
            
    count = _in_memory_rate_limit.get(key, 0) + 1
    _in_memory_rate_limit[key] = count
    
    if count > limit:
        return False
    return True

# Redis cache helpers
def get_cached_value(key: str) -> Optional[str]:
    if redis_client:
        try:
            return redis_client.get(key)
        except Exception:
            pass
    return None

def set_cached_value(key: str, value: str, expire_seconds: int = 86400) -> None:
    if redis_client:
        try:
            redis_client.setex(key, expire_seconds, value)
        except Exception:
            pass
