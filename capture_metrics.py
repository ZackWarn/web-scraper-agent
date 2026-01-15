"""
Auto-capture and document baseline test metrics
"""

import requests
import json
import time
from datetime import datetime
from tabulate import tabulate

API_BASE = "http://localhost:8000"


def fetch_metrics(job_id: str) -> dict:
    """Fetch job metrics from API"""
    try:
        response = requests.get(f"{API_BASE}/api/status/{job_id}")
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"❌ Error fetching metrics: {e}")
        return None


def wait_for_completion(job_id: str, timeout: int = 1200) -> dict:
    """Poll until job is complete"""
    print(f"\n⏳ Waiting for job {job_id[:8]}... to complete (max {timeout}s)")
    print("-" * 80)

    start = time.time()
    last_status = ""

    while time.time() - start < timeout:
        metrics = fetch_metrics(job_id)
        if not metrics:
            time.sleep(2)
            continue

        status = metrics.get("status", "unknown")
        current = metrics.get("current_domain", "")
        pending = metrics.get("pending_count", 0)
        completed = metrics.get("completed", 0)
        failed = metrics.get("failed", 0)

        status_line = f"[{status.upper()}] Completed: {completed} | Failed: {failed} | Pending: {pending}"
        if current:
            status_line += f" | Current: {current}"

        if status_line != last_status:
            print(f"  {status_line}")
            last_status = status_line

        if status == "waiting_approval":
            print(f"\n✅ Processing complete!")
            return metrics

        time.sleep(1)

    print(f"\n❌ Timeout after {timeout}s")
    return fetch_metrics(job_id)


def format_metrics(metrics: dict) -> str:
    """Format metrics as markdown table"""
    if not metrics:
        return "❌ No metrics data"

    output = []
    output.append("## BASELINE TEST RESULTS (Sequential)\n")
    output.append(f"**Job ID:** {metrics.get('job_id', 'N/A')[:8]}...\n")

    # Get timing info if available
    if "metrics" in metrics and metrics["metrics"]:
        m = metrics["metrics"]
        output.append("### Timing Metrics")
        output.append(f"- **Start Time:** {m.get('start_time', 'N/A')}")
        output.append(f"- **End Time:** {m.get('end_time', 'N/A')}")
        output.append(
            f"- **Total Duration:** {m.get('total_duration_seconds', 0):.2f} seconds"
        )
        output.append(
            f"- **Average per Domain:** {m.get('average_time_per_domain', 0):.2f} seconds"
        )

        total = metrics.get("total", 0)
        if total > 0 and m.get("total_duration_seconds", 0) > 0:
            throughput = (total / m.get("total_duration_seconds", 1)) * 60
            output.append(f"- **Throughput:** {throughput:.2f} domains/min\n")

        # Per-domain times
        if m.get("domain_timings"):
            output.append("### Per-Domain Timings")
            table_data = []
            for domain, timing in m["domain_timings"].items():
                table_data.append(
                    [
                        domain,
                        f"{timing.get('duration_seconds', 0):.2f}s",
                        timing.get("status", "unknown"),
                    ]
                )

            table = tabulate(
                table_data, headers=["Domain", "Time", "Status"], tablefmt="github"
            )
            output.append(table)
            output.append()

    # Success rate
    output.append("### Success Rate")
    total = metrics.get("total", 0)
    completed = metrics.get("completed", 0)
    failed = metrics.get("failed", 0)
    pending = metrics.get("pending_count", 0)

    output.append(f"- **Total Domains:** {total}")
    output.append(f"- **Extracted:** {completed}")
    output.append(f"- **Failed:** {failed}")
    output.append(f"- **Pending Approval:** {pending}")

    if total > 0:
        success_rate = (completed / total) * 100
        output.append(f"- **Success Rate:** {success_rate:.1f}%\n")

    return "\n".join(output)


def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python capture_metrics.py <job_id>")
        print("\nExample:")
        print("  1. Submit test via API or UI and get job_id")
        print("  2. Run: python capture_metrics.py a1b2c3d4-...")
        sys.exit(1)

    job_id = sys.argv[1]

    print(f"\n🎯 Capturing metrics for job: {job_id[:8]}...\n")

    # Wait for completion
    final_metrics = wait_for_completion(job_id)

    # Format and print
    report = format_metrics(final_metrics)
    print("\n" + "=" * 80)
    print(report)
    print("=" * 80)

    # Save to file
    filename = f"baseline_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
    with open(filename, "w") as f:
        f.write(report)
    print(f"\n💾 Saved to: {filename}")


if __name__ == "__main__":
    main()
