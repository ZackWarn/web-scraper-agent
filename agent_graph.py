"""
LangGraph Agent for Company Intelligence Pipeline
Orchestrates: Scraping -> LLM Extraction -> Database Storage
"""

import logging
from typing import TypedDict, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
import operator
import httpx
from bs4 import BeautifulSoup
import json
import db_new
from worker_new import preprocess_text, build_prompt, save_extracted_data

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)


# State definition
class AgentState(TypedDict):
    """State passed between nodes"""

    domain: str
    raw_html: str
    preprocessed_text: str
    llm_response: str
    extracted_data: dict
    status: str
    error: str
    messages: Annotated[Sequence[str], operator.add]
    skip_save: bool


# Node Functions
def scrape_website(state: AgentState) -> AgentState:
    """Node 1: Scrape website content"""
    domain = state["domain"]
    logging.info(f"[SCRAPE] Starting scrape for {domain}")

    try:
        url = f"https://{domain}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }

        with httpx.Client(timeout=30.0, follow_redirects=True) as client:
            response = client.get(url, headers=headers)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")

        # Remove scripts and styles
        for tag in soup(["script", "style", "noscript", "iframe"]):
            tag.decompose()

        text = soup.get_text(separator=" ", strip=True)

        return {
            **state,
            "raw_html": response.text,
            "preprocessed_text": text,
            "status": "scraped",
            "messages": [f"[OK] Scraped {domain}: {len(text)} chars"],
        }

    except Exception as e:
        logging.error(f"[SCRAPE] Failed {domain}: {e}")
        return {
            **state,
            "status": "scrape_failed",
            "error": str(e),
            "messages": [f"[ERR] Scrape failed {domain}: {e}"],
        }


def preprocess_content(state: AgentState) -> AgentState:
    """Node 2: Preprocess scraped content"""
    domain = state["domain"]
    logging.info(f"[PREPROCESS] Processing content for {domain}")

    try:
        raw_text = state["preprocessed_text"]
        processed = preprocess_text(raw_text)

        return {
            **state,
            "preprocessed_text": processed,
            "status": "preprocessed",
            "messages": [f"[OK] Preprocessed {domain}: {len(processed)} chars"],
        }

    except Exception as e:
        logging.error(f"[PREPROCESS] Failed {domain}: {e}")
        return {
            **state,
            "status": "preprocess_failed",
            "error": str(e),
            "messages": [f"[ERR] Preprocess failed {domain}: {e}"],
        }


def extract_with_llm(state: AgentState) -> AgentState:
    """Node 3: Extract structured data using LLM"""
    domain = state["domain"]
    logging.info(f"[LLM] Extracting data for {domain}")

    try:
        text = state["preprocessed_text"]
        prompt = build_prompt(text, domain)

        # Call Ollama
        payload = {
            "model": "llama3.2:3b",
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0,
                "num_ctx": 2048,
                "num_predict": 2000,
                "num_thread": 3,
            },
        }

        with httpx.Client(timeout=300.0) as client:
            response = client.post("http://127.0.0.1:11434/api/generate", json=payload)
            response.raise_for_status()
            result = response.json()
            llm_output = result.get("response", "{}")

        # Parse JSON
        data = json.loads(llm_output)

        return {
            **state,
            "llm_response": llm_output,
            "extracted_data": data,
            "status": "extracted",
            "messages": [f"[OK] Extracted data for {domain}"],
        }

    except Exception as e:
        logging.error(f"[LLM] Failed {domain}: {e}")
        return {
            **state,
            "status": "extraction_failed",
            "error": str(e),
            "messages": [f"[ERR] Extraction failed {domain}: {e}"],
        }


def save_to_database(state: AgentState) -> AgentState:
    """Node 4: Save extracted data to database"""
    domain = state["domain"]
    logging.info(f"[DB] Saving data for {domain}")

    try:
        data = state["extracted_data"]
        save_extracted_data(domain, data)

        return {
            **state,
            "status": "saved",
            "messages": [f"[OK] Saved {domain} to database"],
        }

    except Exception as e:
        logging.error(f"[DB] Failed {domain}: {e}")
        return {
            **state,
            "status": "save_failed",
            "error": str(e),
            "messages": [f"[ERR] Save failed {domain}: {e}"],
        }


# Conditional edges
def should_continue_after_scrape(state: AgentState) -> str:
    """Router after scraping"""
    if state["status"] == "scraped":
        return "preprocess"
    else:
        return "end"


def should_continue_after_preprocess(state: AgentState) -> str:
    """Router after preprocessing"""
    if state["status"] == "preprocessed":
        return "extract"
    else:
        return "end"


def should_continue_after_extract(state: AgentState) -> str:
    """Router after extraction"""
    if state["status"] == "extracted":
        if state.get("skip_save", False):
            return "end"
        return "save"
    else:
        return "end"


# Build the graph
def create_agent_graph():
    """Create the LangGraph workflow"""
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("scrape", scrape_website)
    workflow.add_node("preprocess", preprocess_content)
    workflow.add_node("extract", extract_with_llm)
    workflow.add_node("save", save_to_database)

    # Set entry point
    workflow.set_entry_point("scrape")

    # Add conditional edges
    workflow.add_conditional_edges(
        "scrape", should_continue_after_scrape, {"preprocess": "preprocess", "end": END}
    )

    workflow.add_conditional_edges(
        "preprocess",
        should_continue_after_preprocess,
        {"extract": "extract", "end": END},
    )

    workflow.add_conditional_edges(
        "extract", should_continue_after_extract, {"save": "save", "end": END}
    )

    # Final node goes to END
    workflow.add_edge("save", END)

    return workflow.compile()


# Run agent
def process_domain(domain: str, skip_save: bool = False) -> dict:
    """Process a single domain through the agent graph"""
    logging.info(f"=== Starting Agent for {domain} (skip_save={skip_save}) ===")

    # Initialize state
    initial_state = {
        "domain": domain,
        "raw_html": "",
        "preprocessed_text": "",
        "llm_response": "",
        "extracted_data": {},
        "status": "pending",
        "error": "",
        "messages": [],
        "skip_save": skip_save,
    }

    # Create and run graph
    graph = create_agent_graph()
    result = graph.invoke(initial_state)

    # Log final status
    for msg in result.get("messages", []):
        logging.info(msg)

    logging.info(f"=== Agent Complete: {domain} - Status: {result['status']} ===\n")

    return result


if __name__ == "__main__":
    # Initialize database
    db_new.init_db()

    # Test with a single domain
    test_domain = "certification-experts.com"
    result = process_domain(test_domain)

    print(f"\nFinal Status: {result['status']}")
    if result.get("error"):
        print(f"Error: {result['error']}")
