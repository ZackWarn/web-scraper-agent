"""
Monitor CPU and RAM usage for multiple Redis worker processes
Aggregates metrics across all workers for comparison testing
"""

import psutil
import csv
import time
import sys
from datetime import datetime
from pathlib import Path
from typing import List, Dict


def find_worker_processes() -> List[psutil.Process]:
    """Find all redis_worker.py processes"""
    workers = []
    for proc in psutil.process_iter(["pid", "name", "cmdline"]):
        try:
            cmdline = proc.info.get("cmdline", [])
            if cmdline and any("redis_worker.py" in str(arg) for arg in cmdline):
                workers.append(proc)
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return workers


def monitor_multi_workers(duration: int = 1200):
    """Monitor all Redis worker processes"""

    print(f"\n🔍 Searching for Redis worker processes...")

    # Initial scan
    workers = find_worker_processes()

    if not workers:
        print("❌ No Redis worker processes found")
        print("\nMake sure to start workers with: .\\start_workers.ps1")
        sys.exit(1)

    print(f"✅ Found {len(workers)} worker process(es):")
    for w in workers:
        print(f"  - PID {w.pid}: {' '.join(w.cmdline()[-2:])}")

    print(f"\n⏱️  Monitoring for {duration}s (max)")
    print("📊 Tracking aggregate metrics across all workers\n")
    print("-" * 100)
    print(
        f"{'Timestamp':<20} {'Workers':<10} {'Total CPU %':<15} {'Total Mem (MB)':<15} {'Avg CPU %':<15} {'Avg Mem (MB)':<15}"
    )
    print("-" * 100)

    # CSV output
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_file = f"multi_worker_usage_{timestamp}.csv"

    metrics = []
    start_time = time.time()
    peak_total_cpu = 0
    peak_total_mem = 0
    peak_worker_count = 0

    try:
        while time.time() - start_time < duration:
            # Rescan for workers (in case new ones started)
            workers = find_worker_processes()

            if not workers:
                print(f"\n⚠️  All workers have stopped")
                break

            # Collect metrics from all workers
            worker_metrics = []
            for proc in workers:
                try:
                    cpu = proc.cpu_percent(interval=0)
                    mem_mb = proc.memory_info().rss / 1024 / 1024
                    worker_metrics.append({"cpu": cpu, "mem": mem_mb, "pid": proc.pid})
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            if not worker_metrics:
                continue

            # Aggregate metrics
            total_cpu = sum(w["cpu"] for w in worker_metrics)
            total_mem = sum(w["mem"] for w in worker_metrics)
            worker_count = len(worker_metrics)
            avg_cpu = total_cpu / worker_count
            avg_mem = total_mem / worker_count

            timestamp_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            print(
                f"{timestamp_str:<20} {worker_count:<10} {total_cpu:<15.2f} {total_mem:<15.2f} {avg_cpu:<15.2f} {avg_mem:<15.2f}"
            )

            metrics.append(
                {
                    "timestamp": timestamp_str,
                    "worker_count": worker_count,
                    "total_cpu_percent": round(total_cpu, 2),
                    "total_memory_mb": round(total_mem, 2),
                    "avg_cpu_percent": round(avg_cpu, 2),
                    "avg_memory_mb": round(avg_mem, 2),
                }
            )

            peak_total_cpu = max(peak_total_cpu, total_cpu)
            peak_total_mem = max(peak_total_mem, total_mem)
            peak_worker_count = max(peak_worker_count, worker_count)

            time.sleep(1)

    except KeyboardInterrupt:
        print(f"\n\n⏹️  Monitoring stopped by user")

    # Write CSV
    if metrics:
        with open(csv_file, "w", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=[
                    "timestamp",
                    "worker_count",
                    "total_cpu_percent",
                    "total_memory_mb",
                    "avg_cpu_percent",
                    "avg_memory_mb",
                ],
            )
            writer.writeheader()
            writer.writerows(metrics)

        print("\n" + "=" * 100)
        print(f"📊 MULTI-WORKER RESOURCE USAGE SUMMARY")
        print("=" * 100)
        print(f"Duration: {len(metrics)} seconds ({len(metrics)/60:.1f} minutes)")
        print(f"Peak Worker Count: {peak_worker_count}")
        print(f"Peak Total CPU: {peak_total_cpu:.2f}%")
        print(f"Peak Total Memory: {peak_total_mem:.2f} MB")

        if metrics:
            avg_total_cpu = sum(m["total_cpu_percent"] for m in metrics) / len(metrics)
            avg_total_mem = sum(m["total_memory_mb"] for m in metrics) / len(metrics)
            avg_worker_count = sum(m["worker_count"] for m in metrics) / len(metrics)
            avg_cpu_per_worker = sum(m["avg_cpu_percent"] for m in metrics) / len(
                metrics
            )
            avg_mem_per_worker = sum(m["avg_memory_mb"] for m in metrics) / len(metrics)

            print(f"\nAverage Worker Count: {avg_worker_count:.1f}")
            print(f"Average Total CPU: {avg_total_cpu:.2f}%")
            print(f"Average Total Memory: {avg_total_mem:.2f} MB")
            print(f"\nPer-Worker Averages:")
            print(f"  CPU: {avg_cpu_per_worker:.2f}%")
            print(f"  Memory: {avg_mem_per_worker:.2f} MB")

        print(f"\n💾 Data saved to: {csv_file}")
        print("=" * 100)


if __name__ == "__main__":
    duration = int(sys.argv[1]) if len(sys.argv) > 1 else 1200
    monitor_multi_workers(duration)
