class RiskEngine:
    @staticmethod
    def calculate_risk(base_confidence: float, lstm_risk_score: float, indicators: list, similar_scam_score: float = 0.0) -> tuple[float, str]:
        """
        Calculates the final risk score (0-1.0) and risk level.
        Combines BERT base confidence (30%), BiLSTM risk score (20%), indicator heuristics (30%), and RAG similarity (20%).
        """
        # BERT semantic classification weight (30%)
        score = base_confidence * 0.3
        
        # BiLSTM sequential risk weight (20%)
        score += lstm_risk_score * 0.2
        
        # Indicator weights (30% max)
        indicator_weight = 0.0
        for ind in indicators:
            if ind.type == "Urgency/Threat":
                indicator_weight += 0.15
            elif ind.type == "Financial Request":
                indicator_weight += 0.20
            elif ind.type == "Authority Impersonation":
                indicator_weight += 0.25
            elif ind.type == "Suspicious URL":
                indicator_weight += 0.15
            else:
                indicator_weight += 0.08
                
        # Cap indicator influence at 0.3
        indicator_weight = min(indicator_weight, 0.3)
        score += indicator_weight
        
        # RAG Historical match weight (20% max)
        if similar_scam_score > 0.0:
            rag_weight = min(similar_scam_score * 0.2, 0.2)
            score += rag_weight
            
        # Normalize score
        score = min(max(score, 0.0), 1.0)
        
        # Safeguard: if there are no threat indicators and no historical similarity, it's highly likely safe
        # Dampen the score heavily to prevent false positives from ML model noise
        if len(indicators) == 0 and similar_scam_score < 0.35:
            score = score * 0.1

        # Determine Level
        if score < 0.3:
            level = "SAFE"
        elif score < 0.6:
            level = "SUSPICIOUS"
        elif score < 0.85:
            level = "HIGH_RISK"
        else:
            level = "CRITICAL"
            
        return score, level

risk_engine = RiskEngine()
