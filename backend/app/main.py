import logging
from fastapi import FastAPI, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import analyze, audio, dashboard, network, live_monitor
from app.database.database import Base, engine, get_db
from sqlalchemy.orm import Session

from app.core.startup import lifespan
from app.core.logging import setup_logging, request_id_ctx_var
from app.core.limiter import limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import uuid
from starlette.requests import Request

# Setup basic logging
setup_logging()
logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    # Synchronously verify and update database schema (critical for TestClient and hot-reloads)
    try:
        from app.database.database import Base, engine
        from sqlalchemy import inspect, text
        Base.metadata.create_all(bind=engine)
        
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
        logger.error(f"Synchronous database verification failed: {e}")

    # Dynamically inject ffmpeg to system PATH for Whisper decoding
    try:
        from app.core.startup import add_ffmpeg_to_path
        add_ffmpeg_to_path()
    except Exception as e:
        logger.error(f"Failed to run add_ffmpeg_to_path: {e}")

    app = FastAPI(
        title="ASTRA API",
        description="Scam Intelligence Platform",
        version="1.0.0",
        lifespan=lifespan
    )
    
    # Initialize model-loaded state flags (set to True during lifespan startup)
    app.state.classifier_loaded = False
    app.state.asr_loaded = False
    app.state.bert_service = None
    app.state.whisper_service = None
    app.state.rag_service = None
    app.state.lstm_service = None
    
    import sys
    import time
    app.state.limiter = limiter
    app.state.start_time = time.time()
    limiter.enabled = not any("pytest" in x or "test" in x for x in sys.argv)
    app.add_exception_handler(RateLimitExceeded, lambda req, exc: Response(content="Rate limit exceeded", status_code=429))
    app.add_middleware(SlowAPIMiddleware)

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        import time
        start_time = time.time()
        request_id = str(uuid.uuid4())
        request_id_ctx_var.set(request_id)
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        response.headers["X-Request-ID"] = request_id
        
        # Track moving list of latencies in app state
        if not hasattr(request.app.state, "api_latencies"):
            request.app.state.api_latencies = []
        request.app.state.api_latencies.append(process_time * 1000) # in ms
        if len(request.app.state.api_latencies) > 100:
            request.app.state.api_latencies.pop(0)
            
        return response

    # CORS middleware — registered after SlowAPI so preflight OPTIONS requests
    # are handled by CORS before the rate limiter can reject them.
    # Uses allow_origin_regex for dev flexibility (any localhost port),
    # plus explicit production origins.
    production_origins = [settings.FRONTEND_URL] if settings.FRONTEND_URL else []
    app.add_middleware(
        CORSMiddleware,
        allow_origins=production_origins,
        allow_origin_regex=r"http://localhost:\d+",
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS", "PUT", "DELETE"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def security_headers_middleware(request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(self), geolocation=()"
        response.headers["Content-Security-Policy"] = "default-src 'self' http: https: data: blob: 'unsafe-inline' 'unsafe-eval';"
        if not str(request.url).startswith("http://localhost") and not str(request.url).startswith("http://127.0.0.1") and "https" in str(request.url):
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # Include routers
    app.include_router(analyze.router, prefix=settings.API_V1_STR, tags=["Analysis"])
    app.include_router(audio.router, prefix=settings.API_V1_STR, tags=["Audio Intelligence"])
    app.include_router(dashboard.router, prefix=settings.API_V1_STR, tags=["Dashboard"])
    app.include_router(network.router, prefix=settings.API_V1_STR, tags=["Network Intelligence"])
    
    from app.api import rag
    app.include_router(rag.router, prefix=settings.API_V1_STR, tags=["RAG Pipeline"])
    
    from app.api import settings as settings_api
    app.include_router(settings_api.router, prefix=settings.API_V1_STR, tags=["Settings"])
    
    app.include_router(live_monitor.router, tags=["Live Monitor WebSockets"])
    from app.api import auth
    app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["Authentication"])

    # Health check endpoint — no auth, no rate limiting
    from app.api.health import router as health_router
    app.include_router(health_router, prefix=settings.API_V1_STR, tags=["Health"])

    @app.get("/")
    def read_root():
        return {"status": "ASTRA API Active"}

    return app

app = create_app()
