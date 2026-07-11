import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

# Configure engine parameters to handle cloud postgres (Neon) pooler connections drop
engine_args = {}
db_url = settings.DATABASE_URL

if db_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}
else:
    # Postgres configuration
    engine_args["pool_pre_ping"] = True
    engine_args["pool_recycle"] = 300
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20

# Attempt to initialize database engine, with dynamic fallback to SQLite if Neon/Cloud Postgres DNS fails
try:
    engine = create_engine(db_url, **engine_args)
    # Test connection immediately
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    logger.info("Successfully connected to primary database.")
except Exception as e:
    logger.error(f"Failed to connect to primary database: {e}. Falling back to local SQLite.")
    db_url = "sqlite:///./astra_local.db"
    engine_args = {"connect_args": {"check_same_thread": False}}
    engine = create_engine(db_url, **engine_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.database.models.base import Base

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
