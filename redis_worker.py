"""
Redis Worker - Processes domains from Redis queue in parallel.
Multiple instances of this worker can run simultaneously.
"""

import sys
import time
import uuid
from datetime import datetime
from redis_manager import get_redis_manager
from agent_graph import process_domain
from worker_new import save_extracted_data
import db_new


class DomainWorker:
    """Worker that processes domains from Redis queue."""

    def __init__(self, worker_id: str = None):
        """
        Initialize worker.

        Args:
            worker_id: Optional worker identifier (generated if not provided)
        """
        self.worker_id = worker_id or f"worker-{uuid.uuid4().hex[:8]}"
        self.redis = get_redis_manager()
        self.running = False
        self.processed_count = 0

        print(f"[{self.worker_id}] Initialized")

    def start(self):
        """Start processing tasks from the queue."""
        self.running = True
        print(f"[{self.worker_id}] Starting... Waiting for tasks")

        while self.running:
            try:
                # Get next task from queue (blocking with timeout)
                task = self.redis.get_next_task(self.worker_id)

                if task is None:
                    # No tasks available, check if we should keep waiting
                    continue

                # Process the domain
                self.process_task(task)

            except KeyboardInterrupt:
                print(f"\n[{self.worker_id}] Shutting down gracefully...")
                self.running = False
                break
            except Exception as e:
                print(f"[{self.worker_id}] ERROR: {e}")
                time.sleep(1)  # Brief pause before continuing

    def process_task(self, task: dict):
        """
        Process a single domain task.

        Args:
            task: Task dictionary containing job_id and domain
        """
        job_id = task["job_id"]
        domain = task["domain"]

        print(f"[{self.worker_id}] 🔍 Processing {domain} (Job: {job_id[:8]}...)")
        
        # Update worker status - processing started
        self.redis.update_worker_status(job_id, self.worker_id, domain, 10, "processing")
        self.redis.add_log(job_id, "info", f"🔍 Worker {self.worker_id} started processing {domain}")

        start_time = time.time()

        try:
            # Process domain using agent graph
            self.redis.update_worker_status(job_id, self.worker_id, domain, 30, "processing")
            self.redis.add_log(job_id, "info", f"📝 Extracting profile from {domain}...")
            result = process_domain(domain)
            
            self.redis.update_worker_status(job_id, self.worker_id, domain, 70, "processing")

            duration = time.time() - start_time

            status = result.get("status") if result else None
            failed = (status is None) or status.endswith("failed")

            if result and not failed:
                # Success - submit result to Redis
                print(
                    f"[{self.worker_id}] ✅ Extracted {domain} in {duration:.1f}s (status={status})"
                )
                self.redis.update_worker_status(job_id, self.worker_id, domain, 90, "processing")
                self.redis.add_log(job_id, "success", f"✅ {domain} processed successfully in {duration:.2f}s")

                self.redis.submit_result(
                    job_id=job_id, domain=domain, success=True, data=result
                )

                # Also save to database immediately (auto-approval for Redis workers)
                try:
                    save_extracted_data(domain, result)
                    self.redis.update_worker_status(job_id, self.worker_id, domain, 100, "complete")
                    self.redis.add_log(job_id, "info", f"💾 Saved {domain} to database")
                    print(f"[{self.worker_id}] 💾 Saved {domain} to database")
                except Exception as db_error:
                    self.redis.update_worker_status(job_id, self.worker_id, domain, 100, "complete")
                    self.redis.add_log(job_id, "warning", f"⚠️ DB save failed for {domain}: {str(db_error)[:100]}")
                    print(
                        f"[{self.worker_id}] ⚠️ DB save failed for {domain}: {db_error}"
                    )

            else:
                # Failed - log error
                error_msg = (
                    result.get("error", "Unknown error")
                    if result
                    else "No result returned"
                )
                if not error_msg and status:
                    error_msg = f"Status {status}"
                print(f"[{self.worker_id}] ❌ Failed {domain}: {error_msg}")
                self.redis.update_worker_status(job_id, self.worker_id, domain, 100, "error")
                self.redis.add_log(job_id, "error", f"❌ {domain} failed: {error_msg[:100]}")

                self.redis.submit_result(
                    job_id=job_id, domain=domain, success=False, error=error_msg
                )

            self.processed_count += 1

        except Exception as e:
            duration = time.time() - start_time
            error_msg = str(e)
            print(f"[{self.worker_id}] ❌ Exception processing {domain}: {error_msg}")
            self.redis.update_worker_status(job_id, self.worker_id, domain, 100, "error")
            self.redis.add_log(job_id, "error", f"❌ Exception: {error_msg[:100]}")

            self.redis.submit_result(
                job_id=job_id, domain=domain, success=False, error=error_msg
            )
        
        # Reset worker to idle after task completion
        self.redis.update_worker_status(job_id, self.worker_id, None, 0, "idle")

    def stop(self):
        """Stop the worker."""
        self.running = False
        print(
            f"[{self.worker_id}] Stopped after processing {self.processed_count} domains"
        )


def main():
    """Main entry point for worker."""
    # Allow worker ID to be passed as command line argument
    worker_id = sys.argv[1] if len(sys.argv) > 1 else None

    # Check Redis connection
    redis = get_redis_manager()
    if not redis.ping():
        print("ERROR: Cannot connect to Redis. Make sure Redis is running.")
        print(
            "  Windows: Install Redis from https://github.com/microsoftarchive/redis/releases"
        )
        print("  Or use Docker: docker run -d -p 6379:6379 redis:latest")
        sys.exit(1)

    print("✓ Connected to Redis")

    # Initialize database
    db_new.init_db()
    print("✓ Database initialized")

    # Create and start worker
    worker = DomainWorker(worker_id)

    try:
        worker.start()
    except KeyboardInterrupt:
        worker.stop()


if __name__ == "__main__":
    main()
