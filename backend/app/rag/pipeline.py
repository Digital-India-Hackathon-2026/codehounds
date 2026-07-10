"""
ASTRA RAG Pipeline (Offline — TF-IDF + Cosine Similarity)
==============================================================
Fully offline. No HuggingFace/internet needed.
Char n-gram TF-IDF handles Hinglish + Tenglish + English naturally.

Usage:
    python pipeline.py --build
    python pipeline.py --query "aapka OTP share karein"
    python pipeline.py --score "your account will be blocked share OTP now"
    python pipeline.py --serve
"""

import csv, argparse, pickle, warnings
import numpy as np
from pathlib import Path
from collections import Counter
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

warnings.filterwarnings("ignore")

BASE_DIR  = Path(__file__).parent
DATA_DIR  = BASE_DIR / "data"
INDEX_DIR = BASE_DIR / "faiss_index"


# ─────────────────────────────────────────────────────────────
# DATA CLASS
# ─────────────────────────────────────────────────────────────

class Document:
    def __init__(self, text, metadata=None):
        self.text     = text
        self.metadata = metadata or {}


# ─────────────────────────────────────────────────────────────
# LOADERS
# ─────────────────────────────────────────────────────────────

def load_conversation_csv(filepath):
    """Load main dataset — group turns by conv_id."""
    conversations = {}
    with open(filepath, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cid = row["conv_id"]
            if cid not in conversations:
                conversations[cid] = []
            conversations[cid].append(row)

    docs = []
    for cid, turns in conversations.items():
        turns      = sorted(turns, key=lambda x: int(x["turn"]))
        full_text  = " | ".join(t["text"] for t in turns)
        final_risk = float(turns[-1]["risk"])
        max_risk   = max(float(t["risk"]) for t in turns)
        category   = cid.split("_")[0]
        docs.append(Document(full_text, {
            "conv_id":    cid,
            "category":   category,
            "n_turns":    len(turns),
            "max_risk":   round(max_risk, 3),
            "final_risk": round(final_risk, 3),
            "label":      "scam" if final_risk > 0.5 else "legitimate",
            "source":     "conversation_dataset",
        }))
    print(f"  Loaded {len(docs)} conversations from {Path(filepath).name}")
    return docs


def load_rag_documents(filepath):
    """Load analytical tactic documents."""
    docs = []
    with open(filepath, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            docs.append(Document(row["text"], {
                "doc_id":   row["id"],
                "category": row["category"],
                "language": row["language"],
                "label":    row["label"],
                "source":   "rag_tactic_docs",
            }))
    print(f"  Loaded {len(docs)} RAG documents from {Path(filepath).name}")
    return docs


def load_all_documents():
    docs = []
    for fname, loader in [
        ("scam_detection_dataset.csv",  load_conversation_csv),
        ("ASTRA_RAG_Documents.csv", load_rag_documents),
    ]:
        path = DATA_DIR / fname
        if path.exists():
            docs.extend(loader(str(path)))
        else:
            print(f"  [SKIP] {path} not found")
    return docs


# ─────────────────────────────────────────────────────────────
# INDEX
# ─────────────────────────────────────────────────────────────

class ASTRAIndex:
    def __init__(self):
        # Char n-grams: language-agnostic, great for code-switching
        self.vectorizer = TfidfVectorizer(
            analyzer    = "char_wb",
            ngram_range = (2, 4),
            max_features= 50000,
            sublinear_tf= True,
            min_df      = 1,
        )
        self.matrix       = None
        self.docs         = []
        self.scam_weight  = 1.0
        self.legit_weight = 1.0

    def build(self, docs: list):
        self.docs   = docs
        texts       = [d.text for d in docs]
        self.matrix = self.vectorizer.fit_transform(texts)

        # Class-balanced weights (inverse frequency)
        total       = len(docs)
        scam_n      = sum(1 for d in docs if d.metadata.get("label") == "scam")
        legit_n     = sum(1 for d in docs if d.metadata.get("label") == "legitimate")
        self.scam_weight  = total / (2 * scam_n)  if scam_n  else 1.0
        self.legit_weight = total / (2 * legit_n) if legit_n else 1.0

        print(f"  Matrix   : {self.matrix.shape[0]} docs × {self.matrix.shape[1]} features")
        print(f"  Weights  : scam={self.scam_weight:.3f}  legit={self.legit_weight:.3f}")

    def search(self, query: str, k: int = 15):
        q_vec   = self.vectorizer.transform([query])
        scores  = cosine_similarity(q_vec, self.matrix).flatten()
        top_idx = np.argsort(scores)[::-1][:k]
        return [(self.docs[i], float(scores[i])) for i in top_idx]

    def save(self, path: Path):
        path.mkdir(parents=True, exist_ok=True)
        with open(path / "index.pkl", "wb") as f:
            pickle.dump(self, f)
        print(f"  Saved    → {path}/index.pkl")

    @staticmethod
    def load(path: Path):
        with open(path / "index.pkl", "rb") as f:
            idx = pickle.load(f)
        print(f"[✓] Index loaded  ({len(idx.docs)} docs)")
        return idx


SentinelXIndex = ASTRAIndex


# ─────────────────────────────────────────────────────────────
# SCORING
# ─────────────────────────────────────────────────────────────

def score_risk(index: ASTRAIndex, query: str, k: int = 15) -> dict:
    """
    Retrieve top-k similar docs, weight by class balance,
    return 0-1 risk score + verdict + matched category.
    """
    results    = index.search(query, k)
    scam_w     = 0.0
    legit_w    = 0.0
    categories = []

    for doc, sim in results:
        label = doc.metadata.get("label", "unknown")
        cat   = doc.metadata.get("category", "unknown")
        if label == "scam":
            scam_w += sim * index.scam_weight
            categories.append(cat)
        else:
            legit_w += sim * index.legit_weight

    total   = scam_w + legit_w
    risk    = round(scam_w / total, 3) if total > 0 else 0.0
    verdict = "SCAM" if risk >= 0.6 else "SUSPICIOUS" if risk >= 0.4 else "LEGITIMATE"
    top_cat = Counter(categories).most_common(1)

    return {
        "risk_score":            risk,
        "verdict":               verdict,
        "matched_category":      top_cat[0][0] if top_cat else "unknown",
        "scam_evidence_weight":  round(scam_w,  4),
        "legit_evidence_weight": round(legit_w, 4),
    }


def retrieve(index: ASTRAIndex, query: str, k: int = 5) -> list:
    return [
        {
            "similarity": round(sim, 4),
            "label":      doc.metadata.get("label"),
            "category":   doc.metadata.get("category"),
            "source":     doc.metadata.get("source"),
            "text":       doc.text[:300] + ("..." if len(doc.text) > 300 else ""),
        }
        for doc, sim in index.search(query, k)
    ]


# ─────────────────────────────────────────────────────────────
# FASTAPI SERVER
# ─────────────────────────────────────────────────────────────

def start_server():
    try:
        from fastapi import FastAPI
        from pydantic import BaseModel
        import uvicorn
    except ImportError:
        print("Run: pip install fastapi uvicorn")
        return

    app   = FastAPI(title="ASTRA RAG API", version="1.0")
    index = ASTRAIndex.load(INDEX_DIR)

    class TextRequest(BaseModel):
        text: str
        k: int = 5

    @app.get("/health")
    def health():
        return {"status": "ok", "docs_indexed": len(index.docs)}

    @app.post("/score")
    def score_endpoint(req: TextRequest):
        return {"query": req.text, **score_risk(index, req.text)}

    @app.post("/retrieve")
    def retrieve_endpoint(req: TextRequest):
        return {"query": req.text, "results": retrieve(index, req.text, req.k)}

    @app.post("/analyze")
    def analyze_endpoint(req: TextRequest):
        return {
            "query":         req.text,
            "risk_analysis": score_risk(index, req.text),
            "top_matches":   retrieve(index, req.text, req.k),
        }

    print("\n[SERVER] ASTRA RAG API → http://localhost:8000")
    print("  Swagger docs  → http://localhost:8000/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description="ASTRA RAG Pipeline")
    p.add_argument("--build", action="store_true", help="Build index from CSV data")
    p.add_argument("--query", type=str,            help="Retrieve similar docs")
    p.add_argument("--score", type=str,            help="Score risk of a text")
    p.add_argument("--serve", action="store_true", help="Start FastAPI server")
    p.add_argument("--k",    type=int, default=5,  help="Number of results")
    args = p.parse_args()

    if args.build:
        print("[1] Loading documents...")
        docs = load_all_documents()
        print(f"    Total : {len(docs)} documents")
        print("[2] Building index...")
        idx = ASTRAIndex()
        idx.build(docs)
        idx.save(INDEX_DIR)
        print("[✓] Done!")

    elif args.query:
        idx     = ASTRAIndex.load(INDEX_DIR)
        results = retrieve(idx, args.query, args.k)
        print(f"\nQuery: {args.query}\n")
        for i, r in enumerate(results, 1):
            print(f"[{i}] sim={r['similarity']} | {r['label']} | {r['category']}")
            print(f"    {r['text'][:200]}\n")

    elif args.score:
        idx = ASTRAIndex.load(INDEX_DIR)
        r   = score_risk(idx, args.score)
        print(f"\nText     : {args.score}")
        print(f"Risk     : {r['risk_score']}")
        print(f"Verdict  : {r['verdict']}")
        print(f"Category : {r['matched_category']}")

    elif args.serve:
        start_server()
    else:
        p.print_help()


if __name__ == "__main__":
    main()
