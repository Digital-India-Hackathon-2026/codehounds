from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from app.database.models.base import Base, BaseMixin

class ThreatEvent(Base, BaseMixin):
    __tablename__ = "threat_events"

    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"), index=True)
    event_type = Column(String, index=True) # e.g. "OTP detected", "UPI detected"
    description = Column(String)
    is_demo_session = Column(Boolean, default=False, nullable=False)
    
    report = relationship("Report", back_populates="threat_events")
