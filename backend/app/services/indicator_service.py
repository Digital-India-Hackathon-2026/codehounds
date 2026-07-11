from typing import List
from app.schemas.analysis import Indicator

class IndicatorService:
    def extract_indicators(self, text: str) -> List[Indicator]:
        """
        Runs heuristic checks to detect specific scam indicators.
        """
        text_lower = text.lower()
        indicators = []

        import re

        # 1. OTP detection (use word boundaries to avoid matching 'ping', 'finalizing', etc.)
        if re.search(r'\botp\b', text_lower) or re.search(r'\bpin\b', text_lower) or "verification code" in text_lower:
            indicators.append(Indicator(
                type="OTP Request",
                description="The caller/message is asking for a sensitive verification code.",
                confidence=0.9
            ))

        # 2. UPI detection
        if re.search(r'\bupi\b', text_lower) or re.search(r'\bgpay\b', text_lower) or "phonepe" in text_lower:
            indicators.append(Indicator(
                type="UPI Platform",
                description="Mentions of digital payment platforms commonly used for immediate transfers.",
                confidence=0.8
            ))

        # 3. Urgency detection
        urgency_pattern = r'\b(immediate|urgent|block|freeze|suspend|today)\b'
        if re.search(urgency_pattern, text_lower):
            indicators.append(Indicator(
                type="Urgency/Threat",
                description="Language designed to panic the victim into acting quickly.",
                confidence=0.85
            ))

        # 4. Impersonation detection
        impersonation_pattern = r'\b(state bank|sbi|hdfc|icici|rbi|police|customs)\b'
        if re.search(impersonation_pattern, text_lower):
            indicators.append(Indicator(
                type="Authority Impersonation",
                description="Claiming to be from a bank or government authority.",
                confidence=0.95
            ))

        # 5. Payment request detection
        payment_pattern = r'\b(pay|transfer|fee|processing fee|deposit)\b'
        if re.search(payment_pattern, text_lower):
            indicators.append(Indicator(
                type="Financial Request",
                description="Explicit request for money transfer.",
                confidence=0.8
            ))

        return indicators

indicator_service = IndicatorService()
