# Redis Parallel Processing Setup

This guide explains how to set up and use Redis-based parallel processing for the Web Scraper Agent.

## Overview

The Redis implementation enables **parallel processing** of domains across multiple worker processes, significantly improving throughput compared to sequential processing.

### Architecture

```
┌─────────────────┐
│   API Server    │  (api_server.py)
│  POST /process  │  → Creates job in Redis queue
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Redis Server   │  (Queue Manager)
│   Port: 6379    │  → Distributes tasks
└────────┬────────┘
         │
    ┌────┴─────┬──────┬──────┬──────┐
    ▼          ▼      ▼      ▼      ▼
┌────────┐ ┌───────┐ ┌───────┐ ... ┌───────┐
│Worker 1│ │Worker 2│ │Worker 3│     │Worker N│
└────────┘ └───────┘ └───────┘     └───────┘
    │          │         │              │
    └──────────┴─────────┴──────────────┘
                    │
                    ▼
            ┌──────────────┐
            │  Database    │
            │  (SQLite)    │
            └──────────────┘
```

## Prerequisites

### 1. Install Redis Server

#### Windows

Download Redis for Windows from:

- **GitHub Release**: https://github.com/microsoftarchive/redis/releases
- Download `Redis-x64-3.0.504.msi` (or latest)
- Install and start Redis service

Or use Docker:

```powershell
docker run -d -p 6379:6379 --name redis redis:latest
```

#### Linux/macOS

```bash
# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis-server

# macOS
brew install redis
brew services start redis
```

### 2. Install Python Dependencies

```powershell
pip install -r requirements.txt
```

The updated `requirements.txt` includes:

- `redis` - Python Redis client
- `rq` - Redis Queue library
- Other existing dependencies

### 3. Verify Redis Connection

Check if Redis is running:

```powershell
redis-cli ping
# Should return: PONG
```

Or test via Python:

```python
import redis
r = redis.Redis(host='localhost', port=6379, db=0)
print(r.ping())  # Should print: True
```

## Usage

### Starting the System

#### 1. Start Redis Server (if not already running)

```powershell
# If installed as service, it should auto-start
# Otherwise start manually:
redis-server
```

#### 2. Start API Server

```powershell
python api_server.py
```

The server will check Redis connectivity and enable parallel processing if available.

#### 3. Start Worker Pool

Start 5 workers (recommended):

```powershell
.\start_workers.ps1 5
```

Or on Linux/macOS:

```bash
chmod +x start_workers.sh
./start_workers.sh 5
```

You should see:

```
Starting 5 Redis workers...
[1/5] Starting worker-1...
[2/5] Starting worker-2...
[3/5] Starting worker-3...
[4/5] Starting worker-4...
[5/5] Starting worker-5...

✓ All 5 workers started!
  Job IDs: 1, 2, 3, 4, 5

Monitoring worker output (Ctrl+C to stop)...
```

### Submitting Jobs

#### Via API (Parallel Processing)

```powershell
# Submit domains for parallel processing
$domains = @("firesand.co.uk", "s8080.com", "emagine.org", "bespokesupportsolutions.co.uk", "bcs365.co.uk")
$body = @{ domains = $domains } | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:8000/api/process_redis" `
    -Method POST `
    -Body $body `
    -ContentType "application/json"

Write-Host "Job ID: $($response.job_id)"
Write-Host "Mode: $($response.mode)"
```

#### Via UI

1. Go to http://localhost:3000
2. Enter domains (space or comma separated)
3. System automatically uses Redis if available
4. Workers process domains in parallel

### Monitoring

#### Check Job Status

```powershell
$jobId = "your-job-id-here"
$status = Invoke-RestMethod -Uri "http://localhost:8000/api/status/$jobId"
$status | ConvertTo-Json
```

Response includes:

- `status`: "pending", "processing", or "completed"
- `total`: Total domains
- `completed`: Successfully processed domains
- `failed`: Failed domains
- `mode`: "redis_parallel" or "sequential"
- `approved_data`: Extracted data

#### Check Worker Stats

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/worker_stats"
```

#### Monitor Resource Usage

Start monitoring before submitting job:

```powershell
# Monitor all workers
python multi_worker_monitor.py 600  # Monitor for 600 seconds
```

Output shows aggregate metrics:

- Worker count
- Total CPU usage
- Total memory usage
- Per-worker averages

## Performance Comparison

### Sequential Processing (Baseline)

- **Mode**: Single-threaded
- **Throughput**: ~0.727 domains/minute
- **5 domains**: 5m 30s

### Redis Parallel Processing (5 Workers)

- **Mode**: Multi-process parallel
- **Expected Throughput**: 2.5-3.5 domains/minute
- **Expected Time for 5 domains**: ~2 minutes
- **Expected Improvement**: **3.5-5x faster**

## Configuration

### Adjust Worker Count

Based on your system resources:

- **2-4 cores**: 2-3 workers
- **4-8 cores**: 3-5 workers
- **8+ cores**: 5-8 workers

More workers = higher parallelization but more memory usage.

### Redis Configuration

Edit Redis config if needed (`redis.conf`):

```
# Max memory
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
```

## Troubleshooting

### Redis Not Connecting

**Symptom**: "Redis not available" error

**Solutions**:

1. Check Redis is running:

   ```powershell
   redis-cli ping
   ```

2. Check port 6379 is not blocked:

   ```powershell
   netstat -an | findstr "6379"
   ```

3. Restart Redis service:
   ```powershell
   # Windows
   net stop Redis
   net start Redis
   ```

### Workers Not Processing

**Symptom**: Workers start but don't process domains

**Solutions**:

1. Check workers are connected:

   ```powershell
   Invoke-RestMethod -Uri "http://localhost:8000/api/health"
   ```

2. Check Redis queue:

   ```powershell
   redis-cli
   > LLEN domain:pending
   > KEYS job:*
   ```

3. Restart workers:
   - Press Ctrl+C in worker terminal
   - Run `.\start_workers.ps1 5` again

### High Memory Usage

**Symptom**: System slows down with many workers

**Solutions**:

1. Reduce worker count:

   ```powershell
   .\start_workers.ps1 3  # Use 3 instead of 5
   ```

2. Process domains in smaller batches

3. Increase system RAM or use worker rotation

## API Endpoints

### Parallel Processing

- `POST /api/process_redis` - Submit job for parallel processing
- `GET /api/status/{job_id}` - Get job status (supports both modes)
- `GET /api/health` - Check Redis connectivity
- `GET /api/worker_stats` - Get worker statistics

### Sequential Processing (Fallback)

- `POST /api/process` - Submit job for sequential processing

## Comparison Testing

To benchmark sequential vs parallel:

### 1. Run Baseline (Sequential)

```powershell
# Start API server
python api_server.py

# In another terminal, monitor resources
python monitor_resources.py python 600

# Submit job
python capture_metrics.py <job_id>
```

### 2. Run Redis Test (Parallel)

```powershell
# Start Redis
redis-server

# Start API server
python api_server.py

# Start workers
.\start_workers.ps1 5

# In another terminal, monitor workers
python multi_worker_monitor.py 600

# Submit job via /api/process_redis
python capture_metrics.py <job_id>
```

### 3. Compare Results

- Sequential: `baseline_results_*.md`
- Parallel: `redis_results_*.md`
- Resource usage: CSVs with timestamps

## Architecture Details

### Components

#### 1. Redis Manager (`redis_manager.py`)

- Manages Redis connection
- Creates and tracks jobs
- Distributes tasks to workers
- Collects results

#### 2. Redis Worker (`redis_worker.py`)

- Polls Redis queue for tasks
- Processes domains using agent_graph
- Saves results to database
- Auto-approves extracted data

#### 3. API Server (`api_server.py`)

- Provides REST endpoints
- Supports both sequential and parallel modes
- Auto-detects Redis availability
- Graceful fallback to sequential mode

### Data Flow

1. **Job Creation**: API server creates job in Redis
2. **Task Distribution**: Redis distributes domains to workers
3. **Parallel Processing**: Multiple workers process simultaneously
4. **Result Collection**: Workers submit results to Redis
5. **Database Storage**: Workers save approved data to SQLite
6. **Status Updates**: API aggregates status from Redis

### Key Differences from Sequential Mode

| Aspect         | Sequential             | Redis Parallel                  |
| -------------- | ---------------------- | ------------------------------- |
| **Processing** | One domain at a time   | Multiple domains simultaneously |
| **Approval**   | Manual queue           | Auto-approve                    |
| **Scaling**    | Fixed (single process) | Dynamic (multiple workers)      |
| **State**      | In-memory (api_server) | Persistent (Redis)              |
| **Recovery**   | Lost on crash          | Survives restarts               |
| **Monitoring** | Single process         | Multi-process aggregation       |

## Best Practices

1. **Start Small**: Test with 2-3 workers before scaling up
2. **Monitor Resources**: Use `multi_worker_monitor.py` to track usage
3. **Batch Jobs**: Submit 10-20 domains per job for optimal performance
4. **Redis Persistence**: Configure Redis backups for production
5. **Error Handling**: Check logs for SSL or extraction errors
6. **Cleanup**: Stop workers gracefully with Ctrl+C (not kill -9)

## Production Deployment

For production use:

1. **Redis Security**:

   ```conf
   requirepass your_strong_password
   bind 127.0.0.1
   ```

2. **Worker Management**:

   - Use process supervisor (systemd, supervisor, PM2)
   - Auto-restart on failure
   - Log rotation

3. **Load Balancing**:

   - Deploy multiple worker nodes
   - Use Redis Cluster for high availability
   - Monitor queue depth

4. **Database**:
   - Consider PostgreSQL instead of SQLite
   - Add connection pooling
   - Enable replication

## Next Steps

After setup:

1. Run comparison test with same 5 domains
2. Generate performance report
3. Tune worker count based on results
4. Scale to larger domain batches

---

**Need Help?**

- Check logs in worker terminals
- Use `GET /api/health` to diagnose
- Review `BASELINE_PERFORMANCE_REPORT.md` for comparison metrics
