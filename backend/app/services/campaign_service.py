import logging
import uuid
from sqlalchemy.orm import Session
from app.repositories.campaign_repository import CampaignRepository
from app.services.gemini_service import gemini_service
from app.services.rag_service import rag_service

logger = logging.getLogger(__name__)

class CampaignService:
    async def process_report(self, db: Session, report_id: int, transcript: str, risk_level: str, scam_type: str):
        """
        Determines if a report belongs to an existing campaign or creates a new one.
        Returns the Campaign object.
        """
        campaign_name, similarity_score, rag_scam_type = rag_service.retrieve_similar_scams(transcript)
        
        # Link to existing campaign
        if campaign_name and similarity_score > 0.7:
            logger.info(f"Linking report {report_id} to existing campaign: {campaign_name} (Similarity: {similarity_score:.2f})")
            campaign = CampaignRepository.get_by_name(db, campaign_name)
            if campaign:
                CampaignRepository.increment_nodes(db, campaign)
                CampaignRepository.link_report(db, report_id, campaign.id, similarity_score)
                return campaign
        
        # Create new campaign if similarity is low or no campaigns exist
        new_campaign_name = await self._generate_campaign_name(transcript, scam_type)
        logger.info(f"Creating new campaign: {new_campaign_name} for report {report_id}")
        
        campaign = CampaignRepository.create(db, campaign_name=new_campaign_name, threat_level=risk_level)
        CampaignRepository.link_report(db, report_id, campaign.id, 1.0)
        
        from app.services.knowledge_sync_service import knowledge_sync_service
        
        # Sync the new campaign back to RAG
        knowledge_sync_service.sync_campaign_to_chroma(
            text=transcript,
            campaign_name=new_campaign_name,
            scam_type=scam_type
        )
        
        return campaign
        
    async def _generate_campaign_name(self, transcript: str, scam_type: str) -> str:
        """
        Uses LLM to generate a snappy threat actor name, falling back to a generic UUID format.
        """
        try:
            if gemini_service.client:
                from app.services.pii_scrubber import scrub_pii
                scrubbed_transcript = scrub_pii(transcript[:200])
                prompt = f"Given this scam transcript, generate a 2 or 3 word threat intelligence campaign name (e.g., 'Operation FakeBank', 'Phantom Caller'). Transcript: {scrubbed_transcript}"
                response = await gemini_service.client.chat.completions.create(
                    model=gemini_service.model,
                    messages=[
                        {"role": "system", "content": "You are a threat intelligence naming generator. Output ONLY the campaign name, no quotes."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=15
                )
                name = response.choices[0].message.content.strip().replace('"', '')
                if name:
                    return name
        except Exception as e:
            logger.error(f"Failed to generate campaign name from LLM: {e}")
            
        short_uuid = str(uuid.uuid4())[:8]
        clean_type = scam_type.replace(" ", "").replace("/", "-")
        return f"Campaign-{clean_type}-{short_uuid}"

campaign_service = CampaignService()
