"""
FastAPI server for Company Intelligence Agent
Provides REST API for UI to interact with LangGraph agent
"""

from fastapi import FastAPI, BackgroundTasks, HTTPException, UploadFile, File
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import io
import csv
import sqlite3
import asyncio
from pathlib import Path
import logging
from agent_graph import process_domain
import db_new
from worker_new import save_extracted_data
import time
from redis_manager import get_redis_manager

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="Company Intelligence API")

# Check Redis availability at startup
REDIS_AVAILABLE = False
try:
    redis_manager = get_redis_manager()
    REDIS_AVAILABLE = redis_manager.ping()
    if REDIS_AVAILABLE:
        logging.info("Redis connected - parallel processing available")
    else:
        logging.warning("Redis not available - parallel processing disabled")
except Exception as e:
    logging.warning(f"Redis connection failed: {e}")

# CORS setup for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state for tracking jobs
processing_jobs = {}


class DomainInput(BaseModel):
    domains: List[str]


class JobStatus(BaseModel):
    job_id: str
    status: str
    total: int
    completed: int
    failed: int
    current_domain: Optional[str] = None
    last_extracted: Optional[dict] = None


class CompanyData(BaseModel):
    domain: str
    company_name: Optional[str]
    industry: Optional[str]
    description: Optional[str]
    phone: Optional[str]
    email: Optional[str]
    address: Optional[str]
    linkedin: Optional[str]
    certifications: List[str]
    services: List[str]


def normalize_domains(raw_domains: List[str]) -> List[str]:
    """Split domains on commas/whitespace, strip protocol/paths, dedupe."""
    cleaned: List[str] = []
    for entry in raw_domains:
        if not entry:
            continue
        # Allow space- or comma-separated domains in a single line
        for token in entry.replace(",", " ").split():
            d = token.strip()
            if not d:
                continue
            d = d.lower()
            if d.startswith(("http://", "https://")):
                d = d.split("://", 1)[-1]
            d = d.split("/")[0]
            cleaned.append(d)

    # Preserve order while removing duplicates
    seen = set()
    result: List[str] = []
    for d in cleaned:
        if d in seen:
            continue
        seen.add(d)
        result.append(d)
    return result


def process_domains_background(job_id: str, domains: List[str]):
    """Background task to process domains. Queues extracted data for approval without blocking."""
    from datetime import datetime

    def add_log(level: str, message: str):
        """Add a log entry"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        processing_jobs[job_id]["logs"].append(
            {"timestamp": timestamp, "level": level, "message": message}
        )

    processing_jobs[job_id] = {
        "status": "processing",
        "total": len(domains),
        "completed": 0,
        "failed": 0,
        "current_domain": None,
        "logs": [],
        "pending_approvals": {},
        "approved_data": {},
        "rejected_domains": [],
    }

    add_log("info", f"🚀 Starting to process {len(domains)} domains")

    for domain in domains:
        processing_jobs[job_id]["current_domain"] = domain
        try:
            add_log("info", f"🔍 Scraping & Extracting {domain}...")

            result = process_domain(domain, skip_save=True)

            if result.get("extracted_data") and result["status"] == "extracted":
                processing_jobs[job_id]["pending_approvals"][domain] = result[
                    "extracted_data"
                ]
                add_log(
                    "info",
                    f"⏳ {domain} extracted - queued for approval (non-blocking)",
                )
            else:
                processing_jobs[job_id]["failed"] += 1
                add_log(
                    "error",
                    f"❌ Failed to extract {domain}: {result.get('error', 'Unknown error')}",
                )

        except Exception as e:
            logging.error(f"Error processing {domain}: {e}")
            processing_jobs[job_id]["failed"] += 1
            add_log("error", f"❌ Error processing {domain}: {str(e)}")

    processing_jobs[job_id]["status"] = "waiting_approval"
    processing_jobs[job_id]["current_domain"] = None

    pending_count = len(processing_jobs[job_id]["pending_approvals"])
    add_log(
        "success",
        f"✅ Extraction complete! {pending_count} awaiting approval, {processing_jobs[job_id]['failed']} failed",
    )


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    db_new.init_db()
    logging.info("Database initialized")


@app.post("/api/process")
async def start_processing(input_data: DomainInput, background_tasks: BackgroundTasks):
    """Start processing domains (sequential mode)"""
    import uuid

    job_id = str(uuid.uuid4())

    domains = normalize_domains(input_data.domains)
    if not domains:
        raise HTTPException(status_code=400, detail="No valid domains provided")

    # Start background processing (sequential)
    background_tasks.add_task(process_domains_background, job_id, domains)

    return {
        "job_id": job_id,
        "message": "Processing started (sequential)",
        "count": len(domains),
        "mode": "sequential",
    }


@app.post("/api/process_redis")
async def start_processing_redis(input_data: DomainInput):
    """Start processing domains using Redis workers (parallel mode)"""
    if not REDIS_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Redis not available. Make sure Redis server is running.",
        )

    domains = normalize_domains(input_data.domains)
    if not domains:
        raise HTTPException(status_code=400, detail="No valid domains provided")

    # Create job in Redis
    redis_manager = get_redis_manager()
    job_id = redis_manager.create_job(domains)

    return {
        "job_id": job_id,
        "message": "Processing started (parallel with Redis)",
        "count": len(domains),
        "mode": "redis_parallel",
    }


# Utilities to read domains from a SQLite database
def _get_distinct_domains(db_path: Path) -> List[str]:
    if not db_path.exists():
        raise FileNotFoundError(f"Database not found: {db_path}")
    conn = sqlite3.connect(str(db_path))
    c = conn.cursor()
    try:
        c.execute("SELECT DISTINCT domain FROM contact_information")
        rows = c.fetchall()
    finally:
        conn.close()
    domains: List[str] = []
    for (d,) in rows:
        if not d:
            continue
        d = d.strip().lower()
        if d.startswith("http://") or d.startswith("https://"):
            d = d.split("://", 1)[-1]
        d = d.split("/")[0]
        domains.append(d)
    return sorted(set(domains))


class ProcessFinalInput(BaseModel):
    only_new: bool = True
    limit: Optional[int] = None


@app.post("/api/process_from_final")
async def process_from_final(
    input_data: ProcessFinalInput, background_tasks: BackgroundTasks
):
    """Start processing using domains from the final folder's database.

    only_new=True will exclude domains already present in the agent DB.
    limit can restrict the number of domains to process.
    """
    import uuid

    workspace_root = Path(__file__).resolve().parent.parent
    final_db = workspace_root / "final" / "db.sqlite"
    agent_db = workspace_root / "agent" / "db.sqlite"

    final_domains = _get_distinct_domains(final_db)
    to_process = final_domains

    if input_data.only_new and agent_db.exists():
        agent_domains = _get_distinct_domains(agent_db)
        to_process = sorted(set(final_domains) - set(agent_domains))

    if input_data.limit is not None:
        to_process = to_process[: max(0, int(input_data.limit))]

    if not to_process:
        raise HTTPException(
            status_code=400, detail="No domains to process from final DB"
        )

    job_id = str(uuid.uuid4())
    background_tasks.add_task(process_domains_background, job_id, to_process)

    # Initialize job state immediately so status endpoint is available
    processing_jobs[job_id] = {
        "status": "queued",
        "total": len(to_process),
        "completed": 0,
        "failed": 0,
        "current_domain": None,
        "logs": [
            {
                "timestamp": "",
                "level": "info",
                "message": f"Queued {len(to_process)} domains from final DB",
            }
        ],
        "last_extracted": None,
        "accepted_domains": {},
    }

    return {
        "job_id": job_id,
        "message": "Processing started from final DB",
        "count": len(to_process),
    }


@app.post("/api/process_csv")
async def start_processing_csv(
    file: UploadFile = File(...), background_tasks: BackgroundTasks = None
):
    """Start processing domains from an uploaded CSV file.

    The CSV may include a header. If a header row contains a column named 'domain', that column is used.
    Otherwise the first column is treated as domains.
    """
    import uuid

    raw = await file.read()
    text = raw.decode("utf-8", errors="ignore")
    reader = csv.reader(io.StringIO(text))

    domains: List[str] = []
    header_checked = False
    domain_idx = 0

    for row in reader:
        if not row:
            continue
        if not header_checked:
            header_lower = [c.strip().lower() for c in row]
            if "domain" in header_lower:
                domain_idx = header_lower.index("domain")
                header_checked = True
                continue
            header_checked = True
        if domain_idx >= len(row):
            continue
        dom = row[domain_idx].strip()
        if dom:
            domains.append(dom)

    domains = normalize_domains(domains)

    if not domains:
        raise HTTPException(status_code=400, detail="No domains found in CSV")

    job_id = str(uuid.uuid4())
    background_tasks.add_task(process_domains_background, job_id, domains)

    return {"job_id": job_id, "message": "Processing started", "count": len(domains)}


@app.get("/api/status/{job_id}")
async def get_status(job_id: str):
    """Get processing status with approval queue info.
    Supports both sequential and Redis-based jobs."""

    # Check if it's a Redis job first
    if REDIS_AVAILABLE:
        redis_manager = get_redis_manager()
        redis_job = redis_manager.get_job_status(job_id)

        if redis_job:
            # Convert Redis job format to API format
            results = redis_job.get("results", {})
            successful = sum(1 for r in results.values() if r.get("success"))
            failed = redis_job["failed"]

            # Build logs from results
            logs = []
            for domain, result in results.items():
                if result.get("success"):
                    logs.append(
                        {
                            "timestamp": (
                                result["completed_at"][-8:]
                                if result.get("completed_at")
                                else ""
                            ),
                            "level": "success",
                            "message": f"✅ {domain} processed successfully",
                        }
                    )
                else:
                    logs.append(
                        {
                            "timestamp": (
                                result["completed_at"][-8:]
                                if result.get("completed_at")
                                else ""
                            ),
                            "level": "error",
                            "message": f"❌ {domain} failed: {result.get('error', 'Unknown error')}",
                        }
                    )

            return {
                "status": redis_job["status"],
                "total": redis_job["total"],
                "completed": successful,
                "failed": failed,
                "current_domain": None,
                "logs": logs,
                "pending_approvals": {},  # Redis workers auto-approve
                "approved_data": {
                    d: r["data"] for d, r in results.items() if r.get("success")
                },
                "rejected_domains": [],
                "pending_count": 0,
                "approved_count": successful,
                "rejected_count": 0,
                "mode": "redis_parallel",
                "metrics": redis_job.get("metrics", {}),
            }

    # Fall back to sequential job
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = processing_jobs[job_id]
    return {
        **job,
        "pending_count": len(job.get("pending_approvals", {})),
        "approved_count": len(job.get("approved_data", {})),
        "rejected_count": len(job.get("rejected_domains", [])),
        "mode": "sequential",
    }


class AcceptInput(BaseModel):
    job_id: str
    domain: str
    accept: bool


@app.post("/api/accept_extracted")
async def accept_extracted(input_data: AcceptInput):
    """Approve or reject queued extracted data. Non-blocking."""
    job_id = input_data.job_id
    domain = input_data.domain
    if job_id not in processing_jobs:
        raise HTTPException(status_code=404, detail="Job not found")

    job = processing_jobs[job_id]

    if domain not in job.get("pending_approvals", {}):
        raise HTTPException(
            status_code=404, detail=f"Domain {domain} not in pending approvals"
        )

    from datetime import datetime

    timestamp = datetime.now().strftime("%H:%M:%S")

    if input_data.accept:
        extracted_data = job["pending_approvals"].pop(domain)
        try:
            save_extracted_data(domain, extracted_data)
            job["approved_data"][domain] = extracted_data
            job["completed"] += 1
            job["logs"].append(
                {
                    "timestamp": timestamp,
                    "level": "success",
                    "message": f"✅ Approved and saved {domain}",
                }
            )
        except Exception as e:
            job["failed"] += 1
            job["logs"].append(
                {
                    "timestamp": timestamp,
                    "level": "error",
                    "message": f"❌ Failed to save {domain}: {str(e)}",
                }
            )
    else:
        job["pending_approvals"].pop(domain)
        job["rejected_domains"].append(domain)
        job["completed"] += 1
        job["logs"].append(
            {
                "timestamp": timestamp,
                "level": "warning",
                "message": f"🚫 Rejected {domain}",
            }
        )

    if (
        len(job["pending_approvals"]) == 0
        and job["completed"] + job["failed"] >= job["total"]
    ):
        job["status"] = "completed"

    return {"job_id": job_id, "domain": domain, "accepted": input_data.accept}


@app.get("/api/companies")
async def get_companies(limit: int = 50, offset: int = 0):
    """Get all processed companies"""
    conn = db_new.get_conn()
    cursor = conn.cursor()

    # Get company data with LEFT JOINs
    query = """
    SELECT DISTINCT
        ci.domain,
        comp.company_name,
        di.industry,
        di.long_description,
        ci.phone,
        ci.email,
        ci.full_address,
        sm.linkedin
    FROM contact_information ci
    LEFT JOIN company_information comp ON ci.domain = comp.domain
    LEFT JOIN description_industry di ON ci.domain = di.domain
    LEFT JOIN social_media sm ON ci.domain = sm.domain
    ORDER BY ci.domain
    LIMIT ? OFFSET ?
    """

    cursor.execute(query, (limit, offset))
    rows = cursor.fetchall()

    companies = []
    for row in rows:
        domain = row[0]

        # Get certifications
        cursor.execute(
            "SELECT certification FROM certifications WHERE domain = ?", (domain,)
        )
        certs = [r[0] for r in cursor.fetchall()]

        # Get services
        cursor.execute("SELECT item_name FROM services WHERE domain = ?", (domain,))
        services = [r[0] for r in cursor.fetchall()]

        companies.append(
            {
                "domain": domain,
                "company_name": row[1],
                "industry": row[2],
                "description": row[3],
                "phone": row[4],
                "email": row[5],
                "address": row[6],
                "linkedin": row[7],
                "certifications": certs,
                "services": services,
            }
        )

    # Get total count
    cursor.execute("SELECT COUNT(DISTINCT domain) FROM contact_information")
    total = cursor.fetchone()[0]

    conn.close()

    return {"companies": companies, "total": total, "limit": limit, "offset": offset}


@app.get("/api/stats")
async def get_stats():
    """Get database statistics"""
    conn = db_new.get_conn()
    cursor = conn.cursor()

    tables = [
        "contact_information",
        "company_information",
        "social_media",
        "people_information",
        "certifications",
        "services",
        "description_industry",
    ]

    stats = {}
    for table in tables:
        cursor.execute(f"SELECT COUNT(*) FROM {table}")
        stats[table] = cursor.fetchone()[0]

    # Get unique company count
    cursor.execute("SELECT COUNT(DISTINCT domain) FROM contact_information")
    stats["unique_companies"] = cursor.fetchone()[0]

    conn.close()
    return stats


@app.get("/api/graph")
async def get_graph_info():
    """Get LangGraph workflow information"""
    return {
        "nodes": [
            {"id": "scrape", "label": "Scrape Website", "type": "process"},
            {"id": "preprocess", "label": "Preprocess Content", "type": "process"},
            {"id": "extract", "label": "LLM Extract", "type": "llm"},
            {"id": "save", "label": "Save to DB", "type": "storage"},
        ],
        "edges": [
            {"source": "scrape", "target": "preprocess", "label": "success"},
            {"source": "scrape", "target": "end", "label": "failed"},
            {"source": "preprocess", "target": "extract", "label": "success"},
            {"source": "preprocess", "target": "end", "label": "failed"},
            {"source": "extract", "target": "save", "label": "success"},
            {"source": "extract", "target": "end", "label": "failed"},
            {"source": "save", "target": "end", "label": "complete"},
        ],
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint with Redis status"""
    redis_status = "disconnected"
    queue_size = 0

    if REDIS_AVAILABLE:
        try:
            redis_manager = get_redis_manager()
            if redis_manager.ping():
                redis_status = "connected"
                queue_size = redis_manager.get_queue_size()
        except:
            redis_status = "error"

    return {
        "status": "healthy",
        "redis": redis_status,
        "parallel_processing_available": REDIS_AVAILABLE,
        "pending_tasks": queue_size,
    }


@app.get("/api/worker_stats")
async def get_worker_stats():
    """Get Redis worker statistics"""
    if not REDIS_AVAILABLE:
        raise HTTPException(status_code=503, detail="Redis not available")

    redis_manager = get_redis_manager()
    stats = redis_manager.get_worker_stats()

    return stats


@app.get("/api/companies_csv")
async def get_companies_csv(limit: int = 500, offset: int = 0, mode: str = "download"):
    """Return companies as CSV (download) or preview (JSON)"""
    conn = db_new.get_conn()
    cursor = conn.cursor()

    # Base company data
    query = """
    SELECT DISTINCT
        ci.domain,
        comp.company_name,
        di.industry,
        di.long_description,
        ci.phone,
        ci.email,
        ci.full_address,
        sm.linkedin
    FROM contact_information ci
    LEFT JOIN company_information comp ON ci.domain = comp.domain
    LEFT JOIN description_industry di ON ci.domain = di.domain
    LEFT JOIN social_media sm ON ci.domain = sm.domain
    ORDER BY ci.domain
    LIMIT ? OFFSET ?
    """

    cursor.execute(query, (limit, offset))
    rows = cursor.fetchall()

    data_rows = []
    headers = [
        "domain",
        "company_name",
        "industry",
        "description",
        "phone",
        "email",
        "address",
        "linkedin",
        "certifications",
        "services",
    ]

    for row in rows:
        domain = row[0]

        # Certifications and services as pipe-delimited lists
        cursor.execute(
            "SELECT certification FROM certifications WHERE domain = ?", (domain,)
        )
        certs = [r[0] for r in cursor.fetchall()]

        cursor.execute("SELECT item_name FROM services WHERE domain = ?", (domain,))
        services = [r[0] for r in cursor.fetchall()]

        data_rows.append(
            {
                "domain": domain,
                "company_name": row[1],
                "industry": row[2],
                "description": row[3],
                "phone": row[4],
                "email": row[5],
                "address": row[6],
                "linkedin": row[7],
                "certifications": " | ".join(certs),
                "services": " | ".join(services),
            }
        )

    conn.close()

    if mode == "preview":
        # Return JSON for UI table preview
        return {
            "headers": headers,
            "rows": [[row[h] for h in headers] for row in data_rows],
        }

    # Default: CSV download
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=headers)
    writer.writeheader()
    writer.writerows(data_rows)
    csv_bytes = buffer.getvalue()

    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=companies_export.csv"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
