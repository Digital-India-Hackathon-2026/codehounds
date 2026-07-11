import logging
import pickle
import os
import numpy as np
import onnxruntime as ort
from typing import Tuple
from transformers import AutoTokenizer
from app.core.config import settings

logger = logging.getLogger(__name__)

class BertService:
    def __init__(self):
        self.session = None
        self.label_encoder = None
        self.tokenizer = None
        self.is_loaded = False

    def load_model(self):
        try:
            logger.info(f"Loading tokenizer from {settings.BERT_MODEL_DIR}")
            self.tokenizer = AutoTokenizer.from_pretrained(settings.BERT_MODEL_DIR)
            
            logger.info("Loading label encoder...")
            with open(settings.LABEL_ENCODER_PATH, "rb") as f:
                self.label_encoder = pickle.load(f)

            # Use the high-accuracy fine-tuned ONNX quantized model
            onnx_path = os.path.join(settings.BERT_MODEL_DIR, "model_int8.onnx")
            logger.info(f"Loading MiniLM ONNX model from {onnx_path}...")
            
            # CPU Execution Provider is standard and safe for Render
            self.session = ort.InferenceSession(onnx_path, providers=['CPUExecutionProvider'])
            self.is_loaded = True
            logger.info("MiniLM ONNX model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load MiniLM ONNX model: {e}")
            self.is_loaded = False

    async def classify(self, text: str) -> Tuple[str, float]:
        """
        Classifies the text to determine the scam type and confidence using ONNX model.
        Includes graceful degradation fallback.
        """
        if not self.is_loaded or not self.session or not self.tokenizer or not self.label_encoder:
            logger.warning("MiniLM Service is offline. Engaging Fallback Rule Engine.")
            return self._fallback_classify(text)

        try:
            # Tokenizer must pad/truncate to exactly 128 as expected by the ONNX model input dimensions
            inputs = self.tokenizer(
                text, 
                return_tensors="np", 
                padding="max_length", 
                truncation=True, 
                max_length=128
            )
            
            ort_inputs = {}
            for inp in self.session.get_inputs():
                if inp.name in inputs:
                    ort_inputs[inp.name] = inputs[inp.name].astype(np.int64)
            
            # Run inference in a background thread to prevent event loop blocking
            import asyncio
            def sync_inference():
                return self.session.run(None, ort_inputs)
                
            outputs = await asyncio.to_thread(sync_inference)
            logits = outputs[0][0]
            
            # Calculate probabilities via softmax
            exp_logits = np.exp(logits - np.max(logits))
            probs = exp_logits / np.sum(exp_logits)
            
            predicted_class = np.argmax(logits)
            confidence = probs[predicted_class]
            
            scam_type = self.label_encoder.inverse_transform([predicted_class])[0]
            
            # Formatting output
            if scam_type.lower() == "normal":
                scam_type = "Legitimate"
                # If legitimate, we return a low confidence of being a scam so it doesn't trigger the risk engine
                return scam_type, 0.0
            
            # If the classification is extremely borderline (confidence < 0.65), override it to Legitimate
            if scam_type.lower() == "fraud" and confidence < 0.65:
                scam_type = "Legitimate"
                return scam_type, 0.0
            
            return scam_type, float(confidence)
            
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
