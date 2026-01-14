import json
from pathlib import Path
from typing import Tuple
import asyncio

import httpx
from bs4 import BeautifulSoup

# Placeholder for BuiltWith; import optional to avoid crash if missing
try:
    import builtwith
except ImportError:  # pragma: no cover
    builtwith = None

# Playwright for JavaScript-heavy sites
try:
    from playwright.async_api import async_playwright

    PLAYWRIGHT_AVAILABLE = True
except ImportError:  # pragma: no cover
    PLAYWRIGHT_AVAILABLE = False


async def fetch_with_playwright(domain: str, timeout: int = 15000) -> str:
    """Fetch HTML using Playwright for JavaScript-heavy sites"""
    if not PLAYWRIGHT_AVAILABLE:
        raise ImportError("Playwright not available")

    url = f"https://{domain}"
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(url, wait_until="networkidle", timeout=timeout)
            html = await page.content()
        finally:
            await browser.close()

        return html


def _run_playwright_sync(domain: str) -> str:
    """Helper to run async Playwright function from sync context."""
    try:
        # Check if there's already an event loop running
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If loop is running, we can't use asyncio.run()
            # This shouldn't happen in this codebase, but handle it gracefully
            raise RuntimeError(
                "Cannot use asyncio.run() when event loop is already running"
            )
    except RuntimeError:
        # No event loop exists, safe to create one
        pass
    
    return asyncio.run(fetch_with_playwright(domain))


def fetch_live_html(domain: str, use_playwright: bool = False) -> Tuple[str, str]:
    """
    Fetch HTML from domain.
    First tries httpx (fast), falls back to Playwright if needed or if explicitly requested.
    """
    url = f"https://{domain}"

    if use_playwright and PLAYWRIGHT_AVAILABLE:
        try:
            html = _run_playwright_sync(domain)
            return url, html
        except Exception as e:
            print(f"  Playwright failed for {domain}, falling back to httpx: {e}")

    # Try httpx first (faster)
    try:
        with httpx.Client(follow_redirects=True, timeout=15.0) as client:
            resp = client.get(url)
            resp.raise_for_status()
            return url, resp.text
    except Exception as e:
        # If httpx fails and Playwright available, try Playwright
        if PLAYWRIGHT_AVAILABLE:
            try:
                html = _run_playwright_sync(domain)
                return url, html
            except Exception as e2:
                raise Exception(
                    f"Both httpx and Playwright failed: httpx={e}, playwright={e2}"
                )
        raise


def clean_html(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = soup.get_text(" ", strip=True)
    return text


def detect_tech(url: str) -> list[str]:
    """Detect technologies used on a website"""
    if builtwith is None:
        return []
    try:
        data = builtwith.parse(url, timeout=5)
        return sorted({tech for items in data.values() for tech in items})
    except Exception as e:
        # Silently skip tech detection errors
        return []


def persist_snapshot(domain: str, html: str, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = output_dir / f"{domain.replace('.', '_')}.html"
    snapshot_path.write_text(html, encoding="utf-8")
    manifest = {
        "domain": domain,
        "snapshot": snapshot_path.name,
    }
    (output_dir / f"{domain.replace('.', '_')}_manifest.json").write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    return snapshot_path


def scrape_domain(
    domain: str, snapshot_dir: Path, use_playwright: bool = False
) -> tuple[str, str, list[str]]:
    """
    Scrape a domain for content and technology stack.

    Args:
        domain: Domain to scrape
        snapshot_dir: Directory to save HTML snapshots
        use_playwright: Force use of Playwright (for JS-heavy sites)

    Returns:
        Tuple of (snapshot_path, clean_text, tech_stack)
    """
    url, html = fetch_live_html(domain, use_playwright=use_playwright)
    snapshot_path = persist_snapshot(domain, html, snapshot_dir)
    clean_text = clean_html(html)
    tech_stack = detect_tech(url)
    return str(snapshot_path), clean_text, tech_stack
