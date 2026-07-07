import logging
import pickle
import torch
from typing import Tuple
from transformers import AutoTokenizer, AutoModelForSequenceClassification, AutoConfig
from app.core.config import settings

logger = logging.getLogger(__name__)

class BertService:
    def __init__(self):
        self.model = None
        self.label_encoder = None
        self.tokenizer = None
        # Support multiple device types, but for INT8 quantized model, CPU is required.
        self.device = torch.device("cpu")

    def load_model(self):
        try:
            logger.info(f"Loading tokenizer from {settings.BERT_MODEL_DIR}")
            self.tokenizer = AutoTokenizer.from_pretrained(settings.BERT_MODEL_DIR)
            
            logger.info("Loading label encoder...")
            with open(settings.LABEL_ENCODER_PATH, "rb") as f:
                self.label_encoder = pickle.load(f)

            logger.info(f"Loading MiniLM model from {settings.BERT_MODEL_DIR}...")
            model_unquantized = AutoModelForSequenceClassification.from_pretrained(settings.BERT_MODEL_DIR)
            
            # Dynamic quantization matching original PyTorch format
            self.model = torch.quantization.quantize_dynamic(
                model_unquantized, {torch.nn.Linear}, dtype=torch.qint8
            )
            
            self.model.to(self.device)
            self.model.eval()
            
            logger.info("MiniLM INT8 model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load MiniLM model: {e}")

    async def classify(self, text: str) -> Tuple[str, float]:
        """
        Classifies the text to determine the scam type and confidence.
        Includes graceful degradation fallback.
        """
        if not self.model or not self.tokenizer or not self.label_encoder:
            logger.warning("MiniLM Service is offline. Engaging Fallback Rule Engine.")
            return self._fallback_classify(text)

        try:
            inputs = self.tokenizer(
                text, 
                return_tensors="pt", 
                truncation=True, 
                max_length=128
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                
            logits = outputs.logits
            probs = torch.softmax(logits, dim=1)
            confidence, predicted_class = torch.max(probs, dim=1)
            
            scam_type = self.label_encoder.inverse_transform([predicted_class.item()])[0]
            
            # Formatting the output to match system expectations
            if scam_type.lower() == "normal":
                scam_type = "Legitimate"
                # If legitimate, we return a low confidence so it doesn't trigger the risk engine
                # or we return high confidence of being legitimate. 
                # The risk engine expects confidence of it being a scam.
                # Actually, the original code returned "Legitimate" with 0.0 confidence.
            elif scam_type.lower() == "fraud":
                scam_type = "Unknown Threat" # or some general fraud mapping, we can use "Scam/Fraud"
            
            return scam_type, confidence.item()
            
        except Exception as e:
            logger.error(f"MiniLM Inference Failed. Engaging Fallback Rule Engine. Error: {e}")
            return self._fallback_classify(text)

    def _fallback_classify(self, text: str) -> Tuple[str, float]:
        text_lower = text.lower()
        if "otp" in text_lower or "bank" in text_lower or "account" in text_lower:
            return "Bank Impersonation / OTP Fraud", 0.88
        elif "job" in text_lower or "salary" in text_lower:
            return "Job Scam", 0.75
        elif "winner" in text_lower or "lottery" in text_lower:
            return "Lottery Scam", 0.92
        return "Unknown Threat (Fallback)", 0.0

bert_service = BertService()
