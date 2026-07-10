import logging
from sqlalchemy.orm import Session
from app.database.models.audit_logs import AuditLog
from app.services.pii_scrubber import scrub_pii

logger = logging.getLogger(__name__)

class AuditLogger:
    @staticmethod
    def log_action(db: Session, action: str, user_id: int = None):
        """
        Logs an action to the audit_logs table.
        All action text is PII-scrubbed before persistence.
        """
        try:
            from app.core.config import settings
            scrubbed_action = scrub_pii(action)
            log = AuditLog(user_id=user_id, action=scrubbed_action, is_demo_session=settings.DEMO_MODE)
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            db.rollback()

audit_logger = AuditLogger()
