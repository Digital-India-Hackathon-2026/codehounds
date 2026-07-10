import logging
import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.indicator_service import indicator_service
from app.services.risk_engine import risk_engine

logger = logging.getLogger(__name__)

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

manager = ConnectionManager()

from jose import jwt, JWTError
from app.core.config import settings

@router.websocket("/ws/live-monitor")
async def websocket_endpoint(websocket: WebSocket, token: str = None):
    """
    WebSocket endpoint for live audio monitoring.
    Expects binary audio chunks, processes them through the intelligence pipeline,
    and returns a JSON payload with transcript, score, and indicators.
    """
    authenticated = False
    username = None

    if token:
        try:
            # Validate JWT Token
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            username = payload.get("sub")
            if username:
                authenticated = True
        except JWTError:
            pass

    if not authenticated:
        if settings.DEMO_MODE:
            username = "demo_user"
        else:
            await websocket.close(code=1008)
            return
        
    await manager.connect(websocket)
    try:
        whisper_service = websocket.app.state.whisper_service
        bert_service = websocket.app.state.bert_service
        rag_service = websocket.app.state.rag_service
        lstm_service = websocket.app.state.lstm_service
        
        while True:
            # Receive audio frame (binary)
            audio_data = await websocket.receive_bytes()
            
            # Step 1: Whisper Transcription
            transcript = await whisper_service.transcribe_chunk(audio_data)
            
            if transcript.strip():
                # Step 2: BERT Classification
                scam_type, confidence = await bert_service.classify(transcript)
                
                # Step 3: Extract Indicators
                indicators = indicator_service.extract_indicators(transcript)
                
                # Step 4: RAG Retrieval
                top_docs = rag_service.retrieve_with_metadata(transcript, top_k=1)
                campaign_name, similarity_score, rag_scam_type = None, 0.0, None
                if top_docs:
                    best_match = top_docs[0]
                    campaign_name = best_match.get("campaign")
                    similarity_score = best_match.get("similarity", 0.0)
                    rag_scam_type = best_match.get("category")
                
                # Step 5: LSTM Risk
                lstm_risk_score, lstm_risk_level, lstm_confidence = lstm_service.predict_risk(transcript)
                
                # Step 6: Calculate Risk Score
                risk_score, risk_level = risk_engine.calculate_risk(
                    base_confidence=confidence if scam_type != "Legitimate" else 0.0,
                    lstm_risk_score=lstm_risk_score,
                    indicators=indicators,
                    similar_scam_score=similarity_score
                )
                
                final_scam_type = scam_type
                if similarity_score > 0.85 and rag_scam_type:
                    final_scam_type = rag_scam_type
                
                # Format payload for frontend
                payload = {
                    "transcript": transcript,
                    "risk_score": risk_score,
                    "risk_level": risk_level,
                    "scam_type": final_scam_type,
                    "indicators": [ind.model_dump() for ind in indicators],
                    "lstm_risk_score": lstm_risk_score,
                    "lstm_risk_level": lstm_risk_level,
                    "lstm_confidence": lstm_confidence,
                    "similar_scams": [{"campaign_name": campaign_name, "similarity_score": similarity_score, "scam_type": rag_scam_type}] if campaign_name else []
                }
                
                # Step 7: Push Updates
                await manager.send_personal_message(json.dumps(payload), websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Live monitor client disconnected")
    except Exception as e:
        logger.error(f"Error in live-monitor websocket: {e}")
        manager.disconnect(websocket)
