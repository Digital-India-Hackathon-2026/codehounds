import logging
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks
from sqlalchemy.orm import Session
from app.schemas.analysis import AnalyzeTextRequest, AnalyzeResponse, SimilarScam
from app.services.risk_engine import risk_engine
from app.services.indicator_service import indicator_service
from app.database.database import get_db, SessionLocal
from app.repositories.report_repository import ReportRepository
from app.services.audit_logger import audit_logger
from app.services.auth_service import get_current_user
from app.database.models import User
from app.core.limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()

async def process_threat_intel_background(
    report_id: int, 
    transcript: str, 
    risk_score: float, 
    risk_level: str, 
    scam_type: str, 
    indicators: list
):
    """
    Background task to handle heavy threat intel operations without blocking the UI.
    """
    logger.info(f"Starting background threat intel for report {report_id}")
    with SessionLocal() as db:
        try:
            from app.services.entity_extractor import entity_extractor
            from app.services.network_service import network_service
            from app.database.models.threat_events import ThreatEvent
            from app.services.campaign_service import campaign_service
            
            extracted_entities = entity_extractor.extract_all(transcript)
            
            # Threat Intelligence: Campaign Management
            campaign = await campaign_service.process_report(
                db, 
                report_id=report_id, 
                transcript=transcript, 
                risk_level=risk_level, 
                scam_type=scam_type
            )
            
            # Link entities to graph
            network_service.process_entities(
                db, 
                entities=extracted_entities, 
                report_id=report_id, 
                risk_score=risk_score,
                campaign_id=campaign.id if campaign else None
            )
            
            # Log threat events
            from app.core.config import settings
            for ind in indicators:
                event = ThreatEvent(
                    report_id=report_id,
                    event_type=f"{ind['type']} Detected",
                    description=ind['description'],
                    is_demo_session=settings.DEMO_MODE
                )
                db.add(event)
                
            db.commit()
            logger.info(f"Completed background threat intel for report {report_id}")
        except Exception as e:
            logger.error(f"Background threat intel failed: {e}")
            db.rollback()

@router.post("/analyze/text", response_model=AnalyzeResponse)
@limiter.limit("20/minute")
async def analyze_text(
    request: Request, 
    body: AnalyzeTextRequest, 
    background_tasks: BackgroundTasks, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analyzes a text transcript for scam patterns orchestrating BERT, Heuristics, and RAG.
    Post-processing is deferred to a background task.
    """
    logger.info(f"Received text analysis request from {current_user.username}")
    audit_logger.log_action(db, "Text Analysis Performed", user_id=current_user.id)
    
    try:
        bert_service = request.app.state.bert_service
        rag_service = request.app.state.rag_service
        lstm_service = request.app.state.lstm_service
        
        scam_type, confidence = await bert_service.classify(body.text)
        indicators = indicator_service.extract_indicators(body.text)
        top_docs = rag_service.retrieve_with_metadata(body.text, top_k=1)
        
        lstm_risk_score, lstm_risk_level, lstm_confidence = lstm_service.predict_risk(body.text)
        
        campaign_name, similarity_score, rag_scam_type = None, 0.0, None
        if top_docs:
            best_match = top_docs[0]
            campaign_name = best_match.get("campaign")
            similarity_score = best_match.get("similarity", 0.0)
            rag_scam_type = best_match.get("category")
        
        risk_score, risk_level = risk_engine.calculate_risk(
            base_confidence=confidence if scam_type != "Legitimate" else 0.0,
            lstm_risk_score=lstm_risk_score,
            indicators=indicators,
            similar_scam_score=similarity_score
        )
        
        final_scam_type = scam_type
        if similarity_score > 0.85 and rag_scam_type:
            final_scam_type = rag_scam_type
            
        similar_scams = []
        if campaign_name:
            similar_scams.append(
                SimilarScam(
                    campaign_name=campaign_name, 
                    similarity_score=similarity_score, 
                    scam_type=rag_scam_type or "Unknown"
                )
            )

        response_data = AnalyzeResponse(
            risk_score=risk_score,
            risk_level=risk_level,
            scam_type=final_scam_type,
            confidence=max(confidence, similarity_score),
            indicators=indicators,
            transcript=body.text,
            similar_scams=similar_scams,
            lstm_risk_score=lstm_risk_score,
            lstm_risk_level=lstm_risk_level,
            lstm_confidence=lstm_confidence
        )
        
        # Step 4: Save to Database
        db_report = ReportRepository.create(
            db,
            text_content=body.text,
            risk_score=risk_score,
            risk_level=risk_level,
            scam_type=final_scam_type,
            confidence=max(confidence, similarity_score),
            indicators=[ind.model_dump() for ind in indicators]
        )
        
        # Step 5: Offload Threat Intel post-processing to BackgroundTask
        # NOTE: Do not pass 'db' session to background task.
        background_tasks.add_task(
            process_threat_intel_background,
            db_report.id,
            body.text,
            risk_score,
            risk_level,
            final_scam_type,
            [ind.model_dump() for ind in indicators]
        )
        
        return response_data
        
    except Exception as e:
        logger.error(f"Error during text analysis: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal server error during text analysis")
