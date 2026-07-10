import pytest
from app.services.pii_scrubber import scrub_pii, extract_pii_entities

def test_clean_text_passes_unchanged():
    text = "This is a clean transcript with no sensitive customer information. System is healthy."
    assert scrub_pii(text) == text
    assert extract_pii_entities(text) == []

def test_email_scrubbing():
    text = "Please reach out to support@sentinelx.net or user.name+label@gmail.com for details."
    expected = "Please reach out to [EMAIL_REDACTED] or [EMAIL_REDACTED] for details."
    assert scrub_pii(text) == expected
    
    entities = extract_pii_entities(text)
    assert len(entities) == 2
    assert entities[0]["type"] == "EMAIL"
    assert entities[1]["type"] == "EMAIL"

def test_indian_phone_number_scrubbing():
    # Test different variations of Indian mobile number
    test_cases = [
        ("Call me on +91 98765 43210 immediately", "Call me on [PHONE_REDACTED] immediately"),
        ("Contact +91-98765-43210", "Contact [PHONE_REDACTED]"),
        ("Operator mobile: 9876543210.", "Operator mobile: [PHONE_REDACTED]."),
        ("Use 09876543210 for payments", "Use [PHONE_REDACTED] for payments"),
        ("Call at +919876543210", "Call at [PHONE_REDACTED]")
    ]
    for raw, scrubbed in test_cases:
        assert scrub_pii(raw) == scrubbed
        entities = extract_pii_entities(raw)
        assert len(entities) == 1
        assert entities[0]["type"] == "PHONE"

def test_aadhaar_scrubbing():
    # Test Aadhaar (12-digit number)
    test_cases = [
        ("My Aadhaar number is 1234-5678-9012", "My Aadhaar number is [AADHAAR_REDACTED]"),
        ("Aadhaar: 1234 5678 9012", "Aadhaar: [AADHAAR_REDACTED]"),
        ("ID is 123456789012.", "ID is [AADHAAR_REDACTED].")
    ]
    for raw, scrubbed in test_cases:
        assert scrub_pii(raw) == scrubbed
        entities = extract_pii_entities(raw)
        assert len(entities) == 1
        assert entities[0]["type"] == "AADHAAR"

def test_credit_card_scrubbing():
    # Test credit cards (13, 15, and 16 digits)
    test_cases = [
        ("Visa: 1234-5678-9012-3456", "Visa: [CARD_REDACTED]"),
        ("Amex: 1234-567890-12345", "Amex: [CARD_REDACTED]"),
        ("Card format: 1234 5678 9012 3456", "Card format: [CARD_REDACTED]"),
        ("Short card: 1234567890123", "Short card: [CARD_REDACTED]"),
        ("No spaces: 1234567890123456", "No spaces: [CARD_REDACTED]")
    ]
    for raw, scrubbed in test_cases:
        assert scrub_pii(raw) == scrubbed
        entities = extract_pii_entities(raw)
        assert len(entities) == 1
        assert entities[0]["type"] == "CARD"

def test_bank_account_scrubbing():
    # Test 9-18 digit numbers representing bank accounts
    text = "Send the money to account number 123456789 or 98765432101234."
    expected = "Send the money to account number [ACCOUNT_REDACTED] or [ACCOUNT_REDACTED]."
    assert scrub_pii(text) == expected
    
    entities = extract_pii_entities(text)
    assert len(entities) == 2
    assert entities[0]["type"] == "ACCOUNT"
    assert entities[1]["type"] == "ACCOUNT"

def test_edge_cases():
    # Card number split oddly with extra spaces
    odd_card = "Visa: 1234  -  5678  -  9012  -  3456"
    assert scrub_pii(odd_card) == "Visa: [CARD_REDACTED]"
    
    # Aadhaar number with dashes instead of no separator
    odd_aadhaar = "Aadhaar number is 9876 - 5432 - 1098"
    assert scrub_pii(odd_aadhaar) == "Aadhaar number is [AADHAAR_REDACTED]"
    
    # Text with both overlaps (e.g. 16-digit card should be CARD, not AADHAAR + ACCOUNT)
    overlap_text = "Card is 1234 5678 9012 3456"
    assert scrub_pii(overlap_text) == "Card is [CARD_REDACTED]"
    
    entities = extract_pii_entities(overlap_text)
    assert len(entities) == 1
    assert entities[0]["type"] == "CARD"
