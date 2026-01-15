# Baseline Performance Test

## Test Configuration

**Date:** January 15, 2026  
**Approach:** Sequential processing (current implementation)  
**Worker Count:** 1 (single-threaded)

## Test Domains

1. firesand.co.uk
2. s8080.com
3. emagine.org
4. bespokesupportsolutions.co.uk
5. bcs365.co.uk

## Instructions

### 1. Start Backend

```bash
python api_server.py
```

### 2. Submit Test via API

```bash
curl -X POST http://localhost:8000/api/process \
  -H "Content-Type: application/json" \
  -d '{"domains": ["firesand.co.uk", "s8080.com", "emagine.org", "bespokesupportsolutions.co.uk", "bcs365.co.uk"]}'
```

Or via UI:

- Go to http://localhost:3000
- Paste: `firesand.co.uk s8080.com emagine.org bespokesupportsolutions.co.uk bcs365.co.uk`
- Click "Start Processing"

### 3. Record Results

**Monitor logs for:**

- Start time (first log entry)
- End time (when status changes to `waiting_approval`)
- Per-domain extraction times
- Success/failure count

**Check status endpoint:**

```bash
curl http://localhost:8000/api/status/{job_id}
```

---

## BASELINE RESULTS (Sequential)

### Timing Metrics

- **Start Time:** _[Record from logs]_
- **End Time:** _[Record from logs]_
- **Total Duration:** _[Calculate: end - start]_
- **Average per Domain:** _[Total / 5]_
- **Throughput:** _[5 / Total duration]_ domains/min

### Success Rate

- **Successful:** _[Count]_ / 5
- **Failed:** _[Count]_ / 5
- **Success Rate:** _[%]_

### Per-Domain Times

| Domain                        | Time (s) | Status |
| ----------------------------- | -------- | ------ |
| firesand.co.uk                |          |        |
| s8080.com                     |          |        |
| emagine.org                   |          |        |
| bespokesupportsolutions.co.uk |          |        |
| bcs365.co.uk                  |          |        |

---

## Notes

- System: _[CPU, RAM specs]_
- Network: _[Connection type]_
- Ollama Model: llama3.2:3b
- Other: _[Any observations]_

---

## Next: Redis Implementation

After recording baseline, implement Redis-based parallel workers and repeat test with same domains.
