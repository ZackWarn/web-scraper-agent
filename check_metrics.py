from redis_manager import get_redis_manager
import json
from datetime import datetime

rm = get_redis_manager()
job = rm.get_job_status('1450a661-19ce-4f32-9d4d-80702ffcbfcf')

print("=== JOB METRICS ===")
print(f"Job ID: {job['job_id']}")
print(f"Status: {job['status']}")
print(f"Total: {job['total']}, Completed: {job['completed']}, Failed: {job['failed']}")
print(f"\nStart Time: {job['created_at']}")
print(f"Processing Started: {job['started_at']}")
if job.get('completed_at'):
    print(f"End Time: {job['completed_at']}")

print("\n=== RESULTS ===")
for domain, result in job.get('results', {}).items():
    status = "✅ SUCCESS" if result['success'] else "❌ FAILED"
    print(f"{domain}: {status}")
    if result.get('error'):
        print(f"  Error: {result['error']}")
    if result.get('completed_at'):
        print(f"  Completed: {result['completed_at']}")

print("\n=== METRICS ===")
metrics = job.get('metrics', {})
print(f"Start: {metrics.get('start_time')}")
print(f"End: {metrics.get('end_time')}")
print(f"Domain Timings: {metrics.get('domain_timings', {})}")
