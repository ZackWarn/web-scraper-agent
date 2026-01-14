"""Load and scrape domains from Topic1_Input_Records(in).csv"""

import csv
import json
import time
from pathlib import Path

from scraper import scrape_domain
from db_new import get_conn, upsert_raw_scrape


def load_domains_from_csv(csv_file: str = "Topic1_Input_Records(in).csv") -> list[str]:
    """Load domains from CSV file."""
    domains = []
    with open(csv_file, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            domain = row.get("domain", "").strip()
            if domain:
                domains.append(domain)
    return domains


def scrape_and_enqueue(domains: list[str], max_domains: int = None) -> None:
    """Scrape domains and add to database."""
    if max_domains:
        domains = domains[:max_domains]

    # Create snapshots directory
    snapshot_dir = Path(__file__).parent / "snapshots"
    snapshot_dir.mkdir(exist_ok=True)

    total = len(domains)
    success = 0
    failed = 0

    print(f"Starting scrape for {total} domains...\n")

    for idx, domain in enumerate(domains, 1):
        print(f"[{idx}/{total}] Scraping {domain}...", end=" ")

        try:
            snapshot_path, clean_text, tech_stack = scrape_domain(domain, snapshot_dir)

            if clean_text:
                upsert_raw_scrape(
                    domain=domain,
                    snapshot_path=snapshot_path,
                    clean_text=clean_text,
                    tech_stack_json=json.dumps(tech_stack),
                    status="READY",
                )
                print(f"✓ OK ({len(clean_text)} chars)")
                success += 1
            else:
                upsert_raw_scrape(
                    domain=domain,
                    snapshot_path="",
                    clean_text="",
                    tech_stack_json="[]",
                    status="FAILED",
                )
                print("✗ No content")
                failed += 1

        except Exception as e:
            print(f"✗ Error: {str(e)[:80]}")
            failed += 1
            try:
                upsert_raw_scrape(
                    domain=domain,
                    snapshot_path="",
                    clean_text="",
                    tech_stack_json="[]",
                    status="FAILED",
                )
            except Exception:
                pass

        # Small delay to be respectful
        if idx < total:
            time.sleep(0.5)

    print(f"\n{'='*60}")
    print(f"Scraping complete!")
    print(f"  Success: {success}")
    print(f"  Failed:  {failed}")
    print(f"  Total:   {total}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    # Load domains from CSV
    csv_path = Path(__file__).parent / "Topic1_Input_Records(in).csv"
    domains = load_domains_from_csv(str(csv_path))

    print(f"Loaded {len(domains)} domains from CSV\n")

    # Ask user how many to scrape
    try:
        choice = input("Enter number of domains to scrape (or 'all'): ").strip().lower()
        if choice == "all":
            max_domains = None
        else:
            max_domains = int(choice)
    except (ValueError, KeyboardInterrupt, EOFError):
        print("Invalid input, scraping first 20 domains")
        max_domains = 20

    # Scrape and enqueue
    scrape_and_enqueue(domains, max_domains)
