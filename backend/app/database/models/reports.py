from sqlalchemy import Column, String, Float, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.database.models.base import Base, BaseMixin

class Report(Base, BaseMixin):
    __tablename__ = "reports"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    source_type = Column(String) # audio or text
    
    transcript = Column(String)
    language = Column(String)
    
    scam_type = Column(String)
    confidence = Column(Float)
    
    risk_score = Column(Float)
    risk_level = Column(String)
    
    explanation = Column(String, nullable=True)
    is_demo_session = Column(Boolean, default=False, nullable=False)

    analyst = relationship("User", back_populates="reports")
    indicators = relationship("Indicator", back_populates="report", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="report", cascade="all, delete-orphan")
    threat_events = relationship("ThreatEvent", back_populates="report", cascade="all, delete-orphan")
    campaign_links = relationship("CampaignReport", back_populates="report", cascade="all, delete-orphan")

class Indicator(Base, BaseMixin):
    __tablename__ = "indicators"

    report_id = Column(Integer, ForeignKey("reports.id", ondelete="CASCADE"))
    indicator_name = Column(String)
    severity = Column(String)
    
    report = relationship("Report", back_populates="indicators")
