import json
import logging
import re
import time
from datetime import datetime
from typing import Any

from ollama import Client  # type: ignore

from db_new import (
    claim_pending_raw,
    insert_contact_information,
    insert_company_information,
    insert_social_media,
    insert_people,
    insert_description_industry,
    insert_certifications,
    insert_services,
    update_raw_status,
    insert_metric,
    get_conn,
)

# Configure logging (INFO level for better performance)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("worker.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

OLLAMA_MODEL = "llama3.2:3b"
OLLAMA_HOST = "http://127.0.0.1:11434"

# Performance settings for 3b model
MAX_TEXT_LENGTH = 8000  # Capture comprehensive content
NUM_CTX = 4096  # Larger context for better understanding
NUM_PREDICT = 3000  # More tokens for complete extraction
PARALLEL_REQUESTS = 2  # Ollama can handle concurrent requests

# Comprehensive extraction matching all Excel table columns
PROMPT_TEMPLATE = """Extract COMPLETE company information. Return ONLY valid JSON.

Required JSON structure with ALL fields:
{{
  "contact_information": {{
    "text": "Business type (e.g., Head Office, Headquarters, Branch)",
    "company_name": "Full legal company name",
    "full_address": "Complete street address",
    "phone": "Main phone number",
    "sales_phone": "Sales department phone",
    "fax": "Fax number",
    "mobile": "Mobile contact number",
    "other_numbers": "Other contact numbers (comma separated)",
    "email": "Main contact email",
    "hours_of_operation": "Business hours (e.g., Monday-Friday: 9am-5pm GMT)",
    "hq_indicator": "Yes/No - is this headquarters?"
  }},
  "company_information": {{
    "company_name": "Official company name",
    "acronym": "Company acronym or short name",
    "logo_url": "URL to company logo if found"
  }},
  "social_media": {{
    "linkedin": "Complete LinkedIn company URL",
    "facebook": "Complete Facebook profile URL",
    "x": "Complete X/Twitter profile URL",
    "instagram": "Complete Instagram profile URL",
    "youtube": "Complete YouTube channel URL",
    "blog": "Company blog URL",
    "articles": "Articles or news section URL"
  }},
  "people_information": [
    {{"name": "Person full name", "title": "Job title", "email": "Email address", "url": "LinkedIn or profile URL"}}
  ],
  "description_industry": {{
    "long_description": "2-3 paragraph detailed company description and what they do",
    "short_description": "1-2 sentence summary of company",
    "sic_code": "UK SIC 2007 code - 5 digits (e.g., 62012 for Business and domestic software development, 62020 for Information technology consultancy, 43220 for Plumbing installation). Choose the MOST SPECIFIC code that matches the company's PRIMARY business activity based on the description.",
    "sic_text": "Full text description of the SIC code chosen",
    "sub_industry": "Specific sub-industry (e.g., Software Development, IT Consulting, Cybersecurity Services)",
    "industry": "Main industry category (e.g., Information Technology, Professional Services, Manufacturing)",
    "sector": "High-level business sector - choose from: Information Technology, Healthcare, Financial Services, Manufacturing & Industrials, Professional Services, Construction & Materials, Education, Real Estate, Retail & Consumer, Transportation, Energy & Utilities, Telecommunications, Media & Entertainment, Public Sector & Government, Agriculture, Other"
  }},
  "certifications": ["ISO 9001:2015", "ISO 27001:2022"],
  "products": ["Product 1 name", "Product 2 name"],
  "services": ["Service 1", "Service 2"]
}}

Tech Stack Detected: {tech_stack}

Website Content to extract from:
{clean_text}

Return ONLY the complete JSON object above filled with extracted data. Use empty strings "" for missing fields and empty arrays [] for missing lists."""


def preprocess_text(clean_text: str) -> str:
    """Preprocess text before feeding to LLM - optimized for speed."""
    # Remove excessive whitespace and non-ASCII (faster)
    text = re.sub(r"\s+", " ", clean_text).encode("ascii", "ignore").decode("ascii")

    # Quick truncate if too long
    if len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]

    # Fast section extraction - only if text is large
    if len(text) > 2000:
        text_lower = text.lower()
        # Find first occurrence of key terms
        for pattern in ["contact", "about", "email", "phone"]:
            idx = text_lower.find(pattern)
            if idx != -1 and idx < 1000:
                # Prioritize beginning with contact info
                text = text[max(0, idx - 200) : MAX_TEXT_LENGTH]
                break

    return text


def build_prompt(clean_text: str, tech_stack: list[str], domain: str = "") -> str:
    hint = ", ".join(tech_stack) if tech_stack else "None detected"
    preprocessed = preprocess_text(clean_text)

    # Add domain context hint for better industry classification
    domain_hint = f"\n\nDomain: {domain}\nUse the domain name as additional context for determining the correct industry and SIC code."

    return (
        PROMPT_TEMPLATE.format(clean_text=preprocessed, tech_stack=hint) + domain_hint
    )


def extract_profile(
    domain: str, clean_text: str, tech_stack: list[str]
) -> dict[str, Any]:
    logger.info(f"Extracting profile for {domain}")
    logger.debug(f"Input text length: {len(clean_text)} chars")

    prompt = build_prompt(clean_text, tech_stack, domain)
    logger.debug(f"Prompt length: {len(prompt)} chars")

    try:
        client = Client(host=OLLAMA_HOST)
        logger.debug(f"Calling Ollama model: {OLLAMA_MODEL}")
        resp = client.generate(
            model=OLLAMA_MODEL,
            prompt=prompt,
            format="json",
            options={
                "temperature": 0,
                "num_ctx": NUM_CTX,
                "num_predict": NUM_PREDICT,
                "num_thread": 3,  # Moderate threads per worker to reduce contention
            },
        )
        raw_text = resp.get("response", "")
        if not raw_text:
            logger.warning(f"Empty response from LLM for {domain}")
            return {}
        logger.info(f"LLM response ({len(raw_text)} chars): {raw_text[:500]}...")
        logger.debug(f"LLM response length: {len(raw_text)} chars")
    except Exception as e:
        logger.error(f"LLM error for {domain}: {str(e)[:120]}")
        return {}

    try:
        profile = json.loads(raw_text)
        logger.info(f"Successfully parsed JSON for {domain}")
        logger.debug(
            f"Extracted keys: {list(profile.keys()) if isinstance(profile, dict) else 'not a dict'}"
        )
        return profile if isinstance(profile, dict) else {}
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error for {domain}: {str(e)[:120]}")
        logger.debug(f"Raw response: {raw_text[:500]}")
        return {}


def save_extracted_data(domain: str, profile: dict[str, Any]) -> None:
    """Save extracted data to all relevant tables."""

    # Contact Information (from nested structure)
    contact = profile.get("contact_information", {})
    if contact and isinstance(contact, dict):
        insert_contact_information(domain, contact)

    # Company Information
    company = profile.get("company_information", {})
    if company and isinstance(company, dict):
        insert_company_information(domain, company)

    # Social Media
    social = profile.get("social_media", {})
    if social and isinstance(social, dict):
        insert_social_media(domain, social)

    # People
    people = profile.get("people_information", [])
    if people and isinstance(people, list):
        insert_people(domain, people)

    # Description & Industry
    desc_ind = profile.get("description_industry", {})
    if desc_ind and isinstance(desc_ind, dict):
        insert_description_industry(domain, desc_ind)

    # Certifications
    certs = profile.get("certifications", [])
    if certs and isinstance(certs, list):
        insert_certifications(domain, certs)

    # Products
    products = profile.get("products", [])
    if products and isinstance(products, list):
        insert_services(domain, products, "product")

    # Services
    services = profile.get("services", [])
    if services and isinstance(services, list):
        insert_services(domain, services, "services")

    # Commit all changes
    conn = get_conn()
    conn.commit()
    conn.close()


def process_once() -> int:
    import random

    worker_id = f"worker_{random.randint(1000, 9999)}"
    pending = claim_pending_raw(worker_id=worker_id, limit=1)
    if not pending:
        return 0

    for row in pending:
        domain = row["domain"]
        clean_text = row["clean_text"] or ""
        tech_stack_json = row["tech_stack"] or "[]"

        try:
            tech_stack = json.loads(tech_stack_json)
        except (json.JSONDecodeError, TypeError, ValueError):
            tech_stack = []

        start_time = datetime.now().isoformat()
        start_ts = time.time()

        try:
            logger.info(f"Processing {domain}...")
            profile = extract_profile(domain, clean_text, tech_stack)

            if profile:
                logger.debug(f"Saving extracted data for {domain}")
                save_extracted_data(domain, profile)

                end_time = datetime.now().isoformat()
                duration = time.time() - start_ts

                logger.info(f"[OK] {domain} ({duration:.2f}s)")
                update_raw_status(domain, "DONE")
                insert_metric(domain, start_time, end_time, duration, True, None)
            else:
                logger.warning(f"{domain}: No data extracted")
                update_raw_status(domain, "DONE")
                end_time = datetime.now().isoformat()
                duration = time.time() - start_ts
                insert_metric(
                    domain, start_time, end_time, duration, False, "No data extracted"
                )

        except Exception as e:
            error_msg = str(e)[:500]
            logger.error(f"{domain}: {error_msg}", exc_info=True)
            update_raw_status(domain, "FAILED")
            end_time = datetime.now().isoformat()
            duration = time.time() - start_ts
            insert_metric(domain, start_time, end_time, duration, False, error_msg)

    return len(pending)


def run_loop() -> None:
    logger.info(f"Worker started | Model: {OLLAMA_MODEL}")
    logger.info("Starting concurrent processing...")
    while True:
        try:
            processed = process_once()
            if processed == 0:
                logger.debug("No pending domains, waiting...")
                time.sleep(2)
        except KeyboardInterrupt:
            logger.info("Stopping worker...")
            break


if __name__ == "__main__":
    run_loop()
