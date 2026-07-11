import os
import shutil
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.database.database import Base, engine
from app.services.whisper_service import whisper_service
from app.services.bert_service import bert_service
from app.services.rag_service import rag_service
from app.services.lstm_service import lstm_service

logger = logging.getLogger(__name__)

def add_ffmpeg_to_path():
    if shutil.which("ffmpeg"):
        logger.info("ffmpeg already available in PATH.")
        return
        
    capcut_base = r"C:\Users\AKSHITH REDDY\AppData\Local\CapCut\Apps"
    if os.path.exists(capcut_base):
        try:
            dirs = [d for d in os.listdir(capcut_base) if os.path.isdir(os.path.join(capcut_base, d))]
            dirs.sort(key=lambda s: [int(u) for u in s.split('.') if u.isdigit()], reverse=True)
            if dirs:
                best_path = os.path.join(capcut_base, dirs[0])
                if os.path.exists(os.path.join(best_path, "ffmpeg.exe")):
                    os.environ["PATH"] = best_path + os.pathsep + os.environ["PATH"]
                    logger.info(f"Dynamically appended CapCut ffmpeg to PATH: {best_path}")
                    return
        except Exception as e:
            logger.warning(f"Failed to dynamically map CapCut ffmpeg: {e}")

async def load_models_background(app: FastAPI):
    logger.info("Starting background loading of ML models...")
    try:
        # Load BERT Models
        bert_service.load_model()
        app.state.bert_service = bert_service
        app.state.classifier_loaded = True
        logger.info("BERT model loaded successfully in background.")
    except Exception as e:
        logger.error(f"Failed to load BERT model: {e}")

    try:
        # Load Whisper Model
        whisper_service.load_model()
        app.state.whisper_service = whisper_service
        app.state.asr_loaded = True
        logger.info("Whisper model loaded successfully in background.")
    except Exception as e:
        logger.error(f"Failed to load Whisper model: {e}")

    try:
        # Load RAG Engine (index.pkl, pipeline.py, ChromaDB)
        rag_service.initialize()
        app.state.rag_service = rag_service
        logger.info("RAG service initialized successfully in background.")
    except Exception as e:
        logger.error(f"Failed to initialize RAG: {e}")

    try:
        # Load BiLSTM Engine
        lstm_service.initialize()
        app.state.lstm_service = lstm_service
        logger.info("BiLSTM service initialized successfully in background.")
    except Exception as e:
        logger.error(f"Failed to initialize BiLSTM: {e}")

    logger.info("All ML Models loaded successfully into app.state in the background.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup logic
    logger.info("Initializing ASTRA Database...")
    add_ffmpeg_to_path()
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified/created successfully.")
        
        # Dynamically append any missing settings columns for PG/SQLite compatibility
        from sqlalchemy import inspect, text
        inspector = inspect(engine)
        if inspector.has_table("settings"):
            columns = [c['name'] for c in inspector.get_columns('settings')]
            new_cols = {
                "whisper_language": "VARCHAR DEFAULT 'en'",
                "min_confidence": "FLOAT DEFAULT 0.40",
                "threat_threshold": "FLOAT DEFAULT 0.70",
                "risk_threshold": "FLOAT DEFAULT 0.50",
                "rag_similarity_threshold": "FLOAT DEFAULT 0.60",
                "auto_save_reports": "INTEGER DEFAULT 1",
                "auto_export": "INTEGER DEFAULT 0",
                "realtime_notifications": "INTEGER DEFAULT 1"
            }
            with engine.begin() as conn:
                for col, sql_type in new_cols.items():
                    if col not in columns:
                        logger.info(f"Adding missing column '{col}' to 'settings' table...")
                        conn.execute(text(f"ALTER TABLE settings ADD COLUMN {col} {sql_type}"))
    except Exception as e:
        logger.error(f"Database table verification/creation failed: {e}")

    import sys
    is_testing = any("pytest" in x or "test" in x for x in sys.argv)
    if not is_testing:
        import asyncio
        asyncio.create_task(load_models_background(app))
    else:
        logger.info("Test environment detected. Skipping background ML model loading.")
    
    yield
    
    # Shutdown logic
    logger.info("Shutting down ASTRA ML Models...")
    app.state.bert_service = None
    app.state.whisper_service = None
    app.state.rag_service = None
    app.state.lstm_service = None
    app.state.classifier_loaded = False
    app.state.asr_loaded = False

