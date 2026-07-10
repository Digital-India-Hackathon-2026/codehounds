from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database.models import Report, Alert

class ReportRepository:
    @staticmethod
    def get_total_count(db: Session) -> int:
        return db.query(func.count(Report.id)).scalar() or 0
        
    @staticmethod
    def get_high_threat_count(db: Session) -> int:
        return db.query(func.count(Report.id)).filter(
            Report.risk_level.in_(["HIGH_RISK", "CRITICAL"])
        ).scalar() or 0
        
    @staticmethod
    def get_critical_alert_count(db: Session) -> int:
        return db.query(func.count(Alert.id)).filter(
            Alert.threat_level == "CRITICAL"
        ).scalar() or 0

    @staticmethod
    def get_recent(db: Session, limit: int = 10) -> List[Report]:
        return db.query(Report).order_by(Report.created_at.desc()).limit(limit).all()

    @staticmethod
    def create(db: Session, text_content: str, risk_score: float, risk_level: str, scam_type: str, confidence: float, indicators: list) -> Report:
        from app.database.models.reports import Indicator
        
        # Convert indicator dicts to SQLAlchemy models
        indicator_models = [
            Indicator(
                indicator_name=ind.get("type", "Unknown"),
                severity="HIGH" if risk_level in ["HIGH_RISK", "CRITICAL"] else "MEDIUM"
            )
            for ind in indicators
        ]
        
        from app.core.config import settings
        
        db_report = Report(
            transcript=text_content,
            risk_score=risk_score,
            risk_level=risk_level,
            scam_type=scam_type,
            confidence=confidence,
            indicators=indicator_models,
            is_demo_session=settings.DEMO_MODE
        )
        db.add(db_report)
        db.flush()
        return db_report
