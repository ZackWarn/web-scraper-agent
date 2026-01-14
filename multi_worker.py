import logging
import multiprocessing
import time
from datetime import datetime, timedelta
from pathlib import Path

from worker_new import process_once
from db_new import get_conn

# Configure logging for multi-worker
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - Worker-%(process)d - %(levelname)s - %(message)s",
    handlers=[logging.FileHandler("multi_worker.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)


def worker_process(worker_id: int, stop_event: multiprocessing.Event) -> None:
    """Run a single worker process until the stop event is signaled."""
    logger.info(f"Worker-{worker_id} started")

    while not stop_event.is_set():
        try:
            processed = process_once()
            if processed == 0:
                time.sleep(2)
        except KeyboardInterrupt:
            logger.info(f"Worker-{worker_id} stopped by user")
            break
        except Exception as e:
            logger.error(f"Worker-{worker_id} error: {str(e)[:100]}", exc_info=True)
            time.sleep(2)

    logger.info(f"Worker-{worker_id} exiting (stop signaled)")


def is_queue_empty() -> bool:
    """Return True when no READY or PROCESSING rows remain in raw_scrapes."""
    conn = get_conn()
    rows = conn.execute(
        """
        SELECT status, COUNT(1) AS cnt
        FROM raw_scrapes
        WHERE status IN ('READY','PROCESSING')
        GROUP BY status
        """
    ).fetchall()
    conn.close()
    # If there are no rows matching READY/PROCESSING, queue is empty
    return len(rows) == 0


def release_stuck_processing(timeout_seconds: int = 900) -> int:
    """Reset rows stuck in PROCESSING beyond timeout back to READY.

    Returns the number of rows released. Uses UTC timestamps matching SQLite CURRENT_TIMESTAMP format.
    """
    threshold = (datetime.utcnow() - timedelta(seconds=timeout_seconds)).strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    conn = get_conn()
    cur = conn.execute(
        """
        UPDATE raw_scrapes
        SET status='READY', updated_at=CURRENT_TIMESTAMP
        WHERE status='PROCESSING' AND updated_at < ?
        """,
        (threshold,),
    )
    conn.commit()
    conn.close()
    released = cur.rowcount if hasattr(cur, "rowcount") else 0
    if released:
        logger.info(
            f"Released {released} stuck PROCESSING rows older than {timeout_seconds}s"
        )
    return released


def main():
    """Launch 6 concurrent worker processes (1 per CPU core)."""
    num_workers = 6
    logger.info(f"Starting {num_workers} concurrent workers...")
    logger.info("Model: llama3.2:1b | Ollama: http://127.0.0.1:11434")
    logger.info(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    stop_event = multiprocessing.Event()

    # Create worker processes
    processes = []
    for i in range(1, num_workers + 1):
        p = multiprocessing.Process(target=worker_process, args=(i, stop_event))
        p.start()
        processes.append(p)
        logger.info(f"Worker-{i} (PID: {p.pid}) launched")

    logger.info(f"All {num_workers} workers running. Press Ctrl+C to stop.")
    logger.info("Logs saved to: worker.log, multi_worker.log")

    try:
        # Monitor queue, release stuck PROCESSING items, and support manual STOP file
        while True:
            time.sleep(5)

            # Manual stop via sentinel file
            if Path("STOP").exists():
                logger.info("STOP file detected. Stopping workers...")
                stop_event.set()
                break

            # Free up any stuck PROCESSING rows
            release_stuck_processing(timeout_seconds=900)

            # Auto-stop when queue is empty
            if is_queue_empty():
                logger.info("Queue empty (no READY/PROCESSING). Stopping workers...")
                stop_event.set()
                break

        # Wait for all processes to exit
        for p in processes:
            p.join()
        logger.info("All workers stopped.")
    except KeyboardInterrupt:
        logger.info("Stopping all workers (keyboard interrupt)...")
        stop_event.set()
        for p in processes:
            p.join()
        logger.info("All workers stopped.")


if __name__ == "__main__":
    # Ensure the multiprocessing entrypoint is invoked on Windows
    main()
