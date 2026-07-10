import time
import hashlib
import secrets
import uuid
import logging
from datetime import datetime, timedelta
from typing import Optional, Tuple, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.core.config import settings
from app.database.database import get_db
from app.database.models import User, RefreshToken

logger = logging.getLogger(__name__)

# Configure bcrypt with strong work factor (rounds=12)
pwd_context = CryptContext(schemes=["bcrypt"], bcrypt__rounds=12, deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False
)

# In-memory TTL cache for validated access tokens to avoid database lookups on every API call
# Format: { token_str: (User, cached_time) }
_token_user_cache: dict[str, Tuple[Any, datetime]] = {}
CACHE_TTL_SECONDS = 300  # 5 minutes

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Constant-time password verification using passlib bcrypt."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Generate secure bcrypt password hash."""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Generate lightweight RFC 7519 compliant JWT access token."""
    to_encode = data.copy()
    now_ts = int(time.time())
    
    if expires_delta:
        exp_ts = now_ts + int(expires_delta.total_seconds())
    else:
        exp_ts = now_ts + (settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        
    # RFC 7519 standard claims
    to_encode.update({
        "iat": now_ts,
        "nbf": now_ts,
        "exp": exp_ts,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "jti": str(uuid.uuid4())
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def hash_token(token_str: str) -> str:
    """SHA-256 hash a refresh token string for secure database storage."""
    return hashlib.sha256(token_str.encode()).hexdigest()

def create_refresh_token(user_id: int, db: Session, client_ip: str = None, user_agent: str = None) -> str:
    """Generate a cryptographic 64-byte URL-safe refresh token and store its SHA-256 hash in DB."""
    token_str = secrets.token_urlsafe(64)
    token_h = hash_token(token_str)
    expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    db_token = RefreshToken(
        token_hash=token_h,
        user_id=user_id,
        expires_at=expires,
        revoked=False,
        client_ip=client_ip,
        user_agent=user_agent
    )
    db.add(db_token)
    db.commit()
    return token_str

def revoke_token_from_cache(token: str):
    """Remove a revoked or logged out token from the in-memory validation cache."""
    _token_user_cache.pop(token, None)

async def get_current_user(token: Optional[str] = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    """
    Validate access token and return current user.
    If a valid token is provided, returns that user.
    Otherwise, falls back to the default user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if token:
        try:
            payload = jwt.decode(
                token, 
                settings.SECRET_KEY, 
                algorithms=[settings.ALGORITHM],
                issuer=settings.JWT_ISSUER,
                audience=settings.JWT_AUDIENCE
            )
            username: str = payload.get("sub")
            if username:
                user = db.query(User).filter(User.username == username).first()
                if user:
                    return user
        except Exception:
            if not settings.DEMO_MODE:
                raise credentials_exception

    if settings.DEMO_MODE:
        user = db.query(User).filter(User.username == "demo_user").first()
        if not user:
            user = User(
                username="demo_user",
                email="demo@sentinelx.net",
                password_hash=get_password_hash("DemoPassword123!"),
                role="analyst"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        return user

    raise credentials_exception
