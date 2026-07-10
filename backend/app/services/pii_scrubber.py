import re
from typing import List, Dict, Any, Tuple

# Compiled Regexes in order of matching priority
PII_PATTERNS = [
    # Credit Card numbers: 16 digits, 15 digits (Amex), 13 digits (with flexible space/dash separators)
    ("CARD", re.compile(
        r'\b(?:\d{4}[-\s]*\d{4}[-\s]*\d{4}[-\s]*\d{4}'
        r'|\d{4}[-\s]*\d{6}[-\s]*\d{5}'
        r'|\d{4}[-\s]*\d{5}[-\s]*\d{4})\b'
    ), "[CARD_REDACTED]"),
    
    # Indian mobile numbers: starts with 6-9, 10 digits total, optional +91/91/0 prefix, flexible separators
    ("PHONE", re.compile(
        r'(?<!\w)(?:(?:\+?91|0)[-\s]*)?[6-9]\d{2}[-\s]*\d{3}[-\s]*\d{4}\b'
        r'|(?<!\w)(?:(?:\+?91|0)[-\s]*)?[6-9]\d{4}[-\s]*\d{5}\b'
        r'|(?<!\w)(?:(?:\+?91|0)[-\s]*)?[6-9]\d{9}\b'
    ), "[PHONE_REDACTED]"),
    
    # Aadhaar numbers: 12 digits (with flexible separators)
    ("AADHAAR", re.compile(r'\b\d{4}[-\s]*\d{4}[-\s]*\d{4}\b'), "[AADHAAR_REDACTED]"),
    
    # Emails
    ("EMAIL", re.compile(r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'), "[EMAIL_REDACTED]"),
    
    # Bank Account numbers: 9 to 18 consecutive digits
    ("ACCOUNT", re.compile(r'\b\d{9,18}\b'), "[ACCOUNT_REDACTED]")
]

def find_pii_spans(text: str) -> List[Dict[str, Any]]:
    """
    Finds all PII spans, resolved in order of priority, ensuring no overlapping matches.
    Returns a sorted list of spans: {"type": str, "start": int, "end": int, "placeholder": str}
    """
    if not text:
        return []
        
    spans = []
    matched_indices = set()
    
    for name, pattern, placeholder in PII_PATTERNS:
        for match in pattern.finditer(text):
            start, end = match.span()
            # If any part of this match is already covered by a higher priority match, skip it
            if any(i in matched_indices for i in range(start, end)):
                continue
                
            spans.append({
                "type": name,
                "start": start,
                "end": end,
                "placeholder": placeholder
            })
            for i in range(start, end):
                matched_indices.add(i)
                
    spans.sort(key=lambda x: x["start"])
    return spans

def scrub_pii(text: str) -> str:
    """
    Scrubs PII from the text, replacing them with labeled placeholders.
    """
    if not text:
        return ""
        
    spans = find_pii_spans(text)
    
    result = []
    last_idx = 0
    for span in spans:
        result.append(text[last_idx:span["start"]])
        result.append(span["placeholder"])
        last_idx = span["end"]
    result.append(text[last_idx:])
    
    return "".join(result)

def extract_pii_entities(text: str) -> List[Dict[str, Any]]:
    """
    Extracts PII entities found in the text (type + original position, not raw value) for auditing.
    """
    if not text:
        return []
        
    spans = find_pii_spans(text)
    entities = []
    for span in spans:
        entities.append({
            "type": span["type"],
            "start": span["start"],
            "end": span["end"]
        })
    return entities
