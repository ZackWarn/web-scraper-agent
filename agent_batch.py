"""
Multi-Domain Agent Processor with LangGraph
Processes multiple domains using the agent graph with parallel execution
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import time
import db_new
from agent_graph import process_domain
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("agent_batch.log"), logging.StreamHandler()],
)


def load_domains(csv_path: str = "Topic1_Input_Records(in).csv", limit: int = None):
    """Load domains from input CSV"""
    df = pd.read_csv(csv_path)
    domains = df["Domain"].dropna().unique().tolist()

    if limit:
        domains = domains[:limit]

    logging.info(f"Loaded {len(domains)} domains from {csv_path}")
    return domains


def process_batch(domains: list, max_workers: int = 4):
    """Process multiple domains in parallel using ThreadPoolExecutor"""
    start_time = time.time()
    results = {"success": 0, "failed": 0, "errors": []}

    logging.info(
        f"Starting batch processing of {len(domains)} domains with {max_workers} workers"
    )

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit all tasks
        future_to_domain = {
            executor.submit(process_domain, domain): domain for domain in domains
        }

        # Process completed tasks
        for future in as_completed(future_to_domain):
            domain = future_to_domain[future]
            try:
                result = future.result()
                if result["status"] == "saved":
                    results["success"] += 1
                else:
                    results["failed"] += 1
                    results["errors"].append(
                        {
                            "domain": domain,
                            "status": result["status"],
                            "error": result.get("error", "Unknown error"),
                        }
                    )
            except Exception as e:
                results["failed"] += 1
                results["errors"].append(
                    {"domain": domain, "status": "exception", "error": str(e)}
                )
                logging.error(f"Exception processing {domain}: {e}")

    elapsed = time.time() - start_time

    # Print summary
    print("\n" + "=" * 60)
    print("BATCH PROCESSING COMPLETE")
    print("=" * 60)
    print(f"Total Domains: {len(domains)}")
    print(f"Success: {results['success']}")
    print(f"Failed: {results['failed']}")
    print(f"Time Elapsed: {elapsed:.2f}s")
    print(f"Avg per domain: {elapsed/len(domains):.2f}s")
    print("=" * 60)

    if results["errors"]:
        print("\nFailed Domains:")
        for err in results["errors"]:
            print(f"  - {err['domain']}: {err['status']} - {err['error']}")

    return results


def main():
    """Main entry point"""
    import sys

    # Initialize database
    db_new.init_db()

    # Get parameters
    if len(sys.argv) > 1:
        num_domains = int(sys.argv[1])
    else:
        num_domains = int(input("Enter number of domains to process: "))

    if len(sys.argv) > 2:
        max_workers = int(sys.argv[2])
    else:
        max_workers = 4

    # Load and process
    domains = load_domains(limit=num_domains)
    results = process_batch(domains, max_workers=max_workers)

    # Check database stats
    print("\n" + "=" * 60)
    print("DATABASE STATISTICS")
    print("=" * 60)

    conn = db_new.get_conn()
    cursor = conn.cursor()

    tables = [
        "description_industry",
        "contact_information",
        "company_information",
        "social_media",
        "people_information",
        "certifications",
        "services",
    ]

    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        count = cursor.fetchone()[0]
        print(f"{table}: {count} rows")

    conn.close()
    print("=" * 60)


if __name__ == "__main__":
    main()
