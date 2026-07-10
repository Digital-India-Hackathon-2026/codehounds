import time
import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

async def check_db_connection(db: Session) -> bool:
    try:
        # Run a lightweight query against the pool
        db.execute(text("SELECT 1"))
        return True
    except Exception as e:
        logger.error(f"Health check database query failed: {e}")
        return False

@router.get("/health")
async def health_check(request: Request, db: Session = Depends(get_db)):
    db_connected = await check_db_connection(db)
    
    classifier_loaded = getattr(request.app.state, "classifier_loaded", False)
    asr_loaded = getattr(request.app.state, "asr_loaded", False)
    start_time = getattr(request.app.state, "start_time", time.time())
    
    # Return error if database or core models are not responsive / loaded
    status = "ok" if (db_connected and classifier_loaded and asr_loaded) else "error"
    
    return {
        "status": status,
        "database": db_connected,
        "ml_model_loaded": classifier_loaded,
        "asr_model_loaded": asr_loaded,
        "uptime_seconds": time.time() - start_time
    }
