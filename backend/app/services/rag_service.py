import logging
from typing import List, Dict, Any, Tuple, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

class RagService:
    def __init__(self):
        self.is_loaded = False
        self.index = None

    def initialize(self):
        """
        Loads the existing RAG pipeline components (FAISS TF-IDF index).
        """
        logger.info("Initializing RAG Service...")
        try:
            import sys
            import os
            from pathlib import Path
            
            # Prevent pipeline.py print statements (like '✓') from crashing Windows consoles
            if hasattr(sys.stdout, 'reconfigure'):
                sys.stdout.reconfigure(encoding='utf-8')
            
            rag_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'rag'))
            sys.path.append(rag_dir)
            
            from app.rag.pipeline import ASTRAIndex
            
            # The pipeline.py load() expects a Path object pointing to the directory containing index.pkl
            self.index = ASTRAIndex.load(Path(rag_dir))
            self.is_loaded = True
            logger.info("RAG Pipeline loaded successfully.")
            
        except ImportError as e:
            logger.error(f"RAG Pipeline files missing or ImportError: {e}")
            self.is_loaded = False
        except Exception as e:
            logger.error(f"Failed to initialize RAG Pipeline: {e}")
            self.is_loaded = False

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top_k documents for a given query using the raw retrieve function.
        """
        if not self.is_loaded or self.index is None:
            logger.warning("RAG Service not loaded. Returning empty retrieval.")
            return []
            
        try:
            from app.rag.pipeline import retrieve as pipeline_retrieve
            return pipeline_retrieve(self.index, query, k=top_k)
        except Exception as e:
            logger.error(f"RAG Retrieval failed for query '{query}': {e}")
            return []

    def retrieve_with_metadata(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieves top_k documents along with fully structured metadata directly from the index.
        """
        if not self.is_loaded or self.index is None:
            logger.warning("RAG Service not loaded. Returning empty retrieval.")
            return []
            
        try:
            # index.search returns [(doc, sim), ...]
            raw_results = self.index.search(query, k=top_k)
            
            normalized_results = []
            for doc, sim in raw_results:
                normalized = {
                    "document": doc.text,
                    "similarity": sim,
                    "metadata": doc.metadata,
                    "source": doc.metadata.get("source", "Unknown"),
                    "category": doc.metadata.get("category", "General"),
                    "language": doc.metadata.get("language", "en"),
                    "campaign": doc.metadata.get("conv_id", "None") # conv_id is the campaign equivalent
                }
                normalized_results.append(normalized)
                
            return normalized_results
        except Exception as e:
            logger.error(f"RAG Metadata Retrieval failed for query '{query}': {e}")
            return []

    def retrieve_similar_scams(self, query: str) -> Tuple[Optional[str], float, Optional[str]]:
        """
        Retrieves the top campaign match for a given query text.
        Returns: (campaign_name, similarity_score, category)
        """
        results = self.retrieve_with_metadata(query, top_k=1)
        if results:
            best = results[0]
            return best.get("campaign"), best.get("similarity", 0.0), best.get("category")
        return None, 0.0, None

    def score_risk(self, query: str) -> Tuple[float, str, str]:
        """
        Scores risk based on the pipeline's heuristics.
        Returns: risk_score, verdict, matched_category
        """
        if not self.is_loaded or self.index is None:
            return 0.0, "UNKNOWN", "unknown"
            
        try:
            from app.rag.pipeline import score_risk as pipeline_score_risk
            res = pipeline_score_risk(self.index, query)
            return res.get("risk_score", 0.0), res.get("verdict", "UNKNOWN"), res.get("matched_category", "unknown")
        except Exception as e:
            logger.error(f"RAG risk scoring failed for query '{query}': {e}")
            return 0.0, "UNKNOWN", "unknown"

rag_service = RagService()
