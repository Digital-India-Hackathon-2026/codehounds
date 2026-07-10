import logging
from typing import Dict, Any, List
from app.services.pii_scrubber import scrub_pii
from app.services.llm_service import llm_service

logger = logging.getLogger(__name__)

class GeminiService:
    """
    Service for external LLM interaction with built-in PII scrubbing.
    Ensures that no customer PII reaches the external LLM provider.
    """
    @property
    def client(self):
        return llm_service.client

    @property
    def model(self):
        return llm_service.model

    async def generate_threat_explanation(self, report_data: Dict[str, Any]) -> str:
        """
        Generates threat explanation, ensuring PII is scrubbed in report metadata/text.
        """
        scrubbed_data = {}
        for k, v in report_data.items():
            if isinstance(v, str):
                scrubbed_data[k] = scrub_pii(v)
            elif isinstance(v, list):
                scrubbed_data[k] = [scrub_pii(x) if isinstance(x, str) else x for x in v]
            else:
                scrubbed_data[k] = v
        return await llm_service.generate_threat_explanation(scrubbed_data)

    async def generate_campaign_summary(self, campaign_name: str, reports: List[Any]) -> str:
        """
        Generates a summary of a campaign using reports, ensuring all reports and name are scrubbed of PII.
        """
        scrubbed_campaign = scrub_pii(campaign_name)
        scrubbed_reports = []
        for r in reports:
            if isinstance(r, str):
                scrubbed_reports.append(scrub_pii(r))
            elif isinstance(r, dict):
                scrubbed_r = {}
                for k, v in r.items():
                    if isinstance(v, str):
                        scrubbed_r[k] = scrub_pii(v)
                    else:
                        scrubbed_r[k] = v
                scrubbed_reports.append(scrub_r)
            else:
                scrubbed_reports.append(r)
        return await llm_service.generate_campaign_summary(scrubbed_campaign, scrubbed_reports)

    async def generate_threat_summary(self, transcript: str, scam_type: str, indicators: List[Any]) -> str:
        """
        Generates a threat summary after scrubbing transcript of PII.
        """
        scrubbed_transcript = scrub_pii(transcript)
        return await llm_service.generate_threat_summary(scrubbed_transcript, scam_type, indicators)

    async def generate_user_recommendations(self, scam_type: str) -> List[str]:
        """
        Generates safety recommendations for a specific scam type.
        """
        return await llm_service.generate_user_recommendations(scam_type)

gemini_service = GeminiService()
