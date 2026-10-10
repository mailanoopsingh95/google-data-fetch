import pytest
from app.core.security import get_password_hash, verify_password, generate_api_key, hash_api_key, create_access_token, decode_access_token
from app.services.billing import billing_service
from app.services.scraper import scraper

def test_password_hashing():
    password = "super_secret_pwd_123"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False

def test_api_key_generation():
    key = generate_api_key()
    assert key.startswith("bi_live_")
    assert len(key) == 40
    
    hashed1 = hash_api_key(key)
    hashed2 = hash_api_key(key)
    assert hashed1 == hashed2
    assert hashed1 != key

def test_jwt_issuance():
    user_id = "user-uuid-12345"
    token = create_access_token(subject=user_id)
    assert token is not None
    
    decoded = decode_access_token(token)
    assert decoded == user_id

def test_billing_quota():
    # Test free quota
    assert billing_service.is_quota_exceeded("free", 50) is False
    assert billing_service.is_quota_exceeded("free", 100) is True
    
    # Test pro quota
    assert billing_service.is_quota_exceeded("pro", 45000) is False
    assert billing_service.is_quota_exceeded("pro", 50000) is True

def test_scraper_regex():
    sample_text = """
    Welcome to our website!
    Contact us at hello@businessintel.co or support@businessintel.co.
    Call our office: +91 9876543210 or 022-24356789.
    Find us on LinkedIn: https://www.linkedin.com/company/business-intel-platform
    and Facebook: https://www.facebook.com/businessintel
    """
    
    emails = scraper._extract_emails(sample_text)
    assert "hello@businessintel.co" in emails
    assert "support@businessintel.co" in emails
    assert len(emails) == 2
    
    phones = scraper._extract_phones(sample_text)
    assert "+91 9876543210" in phones or "9876543210" in "".join(phones)
    
    from bs4 import BeautifulSoup
    html = '<a href="https://linkedin.com/company/businessintel">LinkedIn</a>'
    soup = BeautifulSoup(html, "html.parser")
    socials = scraper._extract_socials(soup)
    assert "https://linkedin.com/company/businessintel" in socials
