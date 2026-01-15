"""
Redis Queue Manager for distributed domain processing.
Handles connection, job submission, and result retrieval.
"""

import redis
import json
from typing import Dict, List, Optional, Any
from datetime import datetime
import uuid


class RedisQueueManager:
    """Manages Redis queues for domain processing jobs."""
    
    def __init__(self, host='localhost', port=6379, db=0):
        """
        Initialize Redis connection.
        
        Args:
            host: Redis server host
            port: Redis server port
            db: Redis database number
        """
        self.redis_client = redis.Redis(
            host=host,
            port=port,
            db=db,
            decode_responses=True
        )
        
        # Queue names
        self.PENDING_QUEUE = "domain:pending"
        self.PROCESSING_QUEUE = "domain:processing"
        self.RESULTS_PREFIX = "result:"
        self.JOB_PREFIX = "job:"
        
    def ping(self) -> bool:
        """Check if Redis is available."""
        try:
            return self.redis_client.ping()
        except redis.ConnectionError:
            return False
    
    def create_job(self, domains: List[str]) -> str:
        """
        Create a new job for processing multiple domains.
        
        Args:
            domains: List of domain names to process
            
        Returns:
            job_id: Unique identifier for this job
        """
        job_id = str(uuid.uuid4())
        
        job_data = {
            "job_id": job_id,
            "domains": domains,
            "total": len(domains),
            "completed": 0,
            "failed": 0,
            "status": "pending",
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "metrics": {
                "start_time": None,
                "end_time": None,
                "domain_timings": {}
            }
        }
        
        # Store job metadata
        self.redis_client.set(
            f"{self.JOB_PREFIX}{job_id}",
            json.dumps(job_data),
            ex=86400  # Expire after 24 hours
        )
        
        # Queue each domain for processing
        for domain in domains:
            task = {
                "job_id": job_id,
                "domain": domain,
                "queued_at": datetime.now().isoformat()
            }
            self.redis_client.rpush(self.PENDING_QUEUE, json.dumps(task))
        
        return job_id
    
    def get_next_task(self, worker_id: str) -> Optional[Dict[str, Any]]:
        """
        Get the next domain task from the queue (blocking with timeout).
        Moves task from pending to processing queue.
        
        Args:
            worker_id: Identifier for the worker requesting the task
            
        Returns:
            Task dictionary or None if queue is empty
        """
        # Block for up to 5 seconds waiting for a task
        result = self.redis_client.blpop(self.PENDING_QUEUE, timeout=5)
        
        if result is None:
            return None
        
        _, task_json = result
        task = json.loads(task_json)
        
        # Add worker info and move to processing queue
        task["worker_id"] = worker_id
        task["started_at"] = datetime.now().isoformat()
        
        processing_key = f"processing:{worker_id}:{task['job_id']}:{task['domain']}"
        self.redis_client.set(processing_key, json.dumps(task), ex=3600)
        
        return task
    
    def submit_result(self, job_id: str, domain: str, success: bool, 
                     data: Optional[Dict] = None, error: Optional[str] = None):
        """
        Submit processing result for a domain.
        
        Args:
            job_id: Job identifier
            domain: Domain that was processed
            success: Whether processing succeeded
            data: Extracted data (if successful)
            error: Error message (if failed)
        """
        result = {
            "job_id": job_id,
            "domain": domain,
            "success": success,
            "completed_at": datetime.now().isoformat(),
            "data": data,
            "error": error
        }
        
        # Store result
        result_key = f"{self.RESULTS_PREFIX}{job_id}:{domain}"
        self.redis_client.set(result_key, json.dumps(result), ex=86400)
        
        # Update job status
        job_key = f"{self.JOB_PREFIX}{job_id}"
        job_json = self.redis_client.get(job_key)
        
        if job_json:
            job = json.loads(job_json)
            
            if success:
                job["completed"] += 1
            else:
                job["failed"] += 1
            
            # Update metrics
            if job["metrics"]["start_time"] is None:
                job["metrics"]["start_time"] = datetime.now().isoformat()
            
            # Check if all domains are processed
            if job["completed"] + job["failed"] >= job["total"]:
                job["status"] = "completed"
                job["completed_at"] = datetime.now().isoformat()
                job["metrics"]["end_time"] = datetime.now().isoformat()
            elif job["status"] == "pending":
                job["status"] = "processing"
                job["started_at"] = datetime.now().isoformat()
            
            self.redis_client.set(job_key, json.dumps(job), ex=86400)
    
    def get_job_status(self, job_id: str) -> Optional[Dict]:
        """
        Get current status of a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Job status dictionary or None if not found
        """
        job_key = f"{self.JOB_PREFIX}{job_id}"
        job_json = self.redis_client.get(job_key)
        
        if not job_json:
            return None
        
        job = json.loads(job_json)
        
        # Get results for completed domains
        results = {}
        for domain in job["domains"]:
            result_key = f"{self.RESULTS_PREFIX}{job_id}:{domain}"
            result_json = self.redis_client.get(result_key)
            if result_json:
                result = json.loads(result_json)
                results[domain] = result
        
        job["results"] = results
        return job
    
    def get_queue_size(self) -> int:
        """Get number of pending tasks in queue."""
        return self.redis_client.llen(self.PENDING_QUEUE)
    
    def get_all_results(self, job_id: str) -> Dict[str, Dict]:
        """
        Get all results for a job.
        
        Args:
            job_id: Job identifier
            
        Returns:
            Dictionary mapping domain to result
        """
        job = self.get_job_status(job_id)
        if job:
            return job.get("results", {})
        return {}
    
    def clear_job(self, job_id: str):
        """
        Clean up all data for a job.
        
        Args:
            job_id: Job identifier
        """
        job = self.get_job_status(job_id)
        if not job:
            return
        
        # Delete job metadata
        self.redis_client.delete(f"{self.JOB_PREFIX}{job_id}")
        
        # Delete all results
        for domain in job["domains"]:
            self.redis_client.delete(f"{self.RESULTS_PREFIX}{job_id}:{domain}")
    
    def get_worker_stats(self) -> Dict[str, int]:
        """Get statistics about queue and workers."""
        return {
            "pending_tasks": self.get_queue_size(),
            "redis_connected": self.ping()
        }


# Singleton instance
_redis_manager = None

def get_redis_manager() -> RedisQueueManager:
    """Get or create the Redis manager singleton."""
    global _redis_manager
    if _redis_manager is None:
        _redis_manager = RedisQueueManager()
    return _redis_manager
