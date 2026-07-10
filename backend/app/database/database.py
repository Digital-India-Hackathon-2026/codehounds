from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Configure engine parameters to handle cloud postgres (Neon) pooler connections drop
engine_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}
else:
    # Postgres configuration
    engine_args["pool_pre_ping"] = True
    engine_args["pool_recycle"] = 300
    engine_args["pool_size"] = 10
    engine_args["max_overflow"] = 20

engine = create_engine(
    settings.DATABASE_URL,
    **engine_args
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from app.database.models.base import Base

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
