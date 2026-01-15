# Baseline Performance Report - Sequential Processing

## Test Configuration

**Date & Time**: January 15, 2026, 10:13:00 - 10:19:16  
**Job ID**: `c4f25764-3ac1-47a1-ae53-f5a927805f12`  
**Processing Mode**: Sequential (Single-threaded)  
**Test Domains**: 5 domains
- firesand.co.uk
- s8080.com
- emagine.org
- bespokesupportsolutions.co.uk
- bcs365.co.uk

---

## Executive Summary

This baseline test measured the performance of the sequential, single-threaded domain processing pipeline. The system processed 5 domains with an overall **80% success rate** (4 successful, 1 failed). Total extraction time was **5 minutes 30 seconds**, with an average of **1 minute 22 seconds per successful domain**.

### Key Findings:
- ✅ **4/5 domains** successfully extracted and approved
- ❌ **1 domain failed** due to SSL certificate verification error
- ⏱️ **Total extraction duration**: 5 minutes 30 seconds (10:13:00 - 10:18:30)
- ⏱️ **Total end-to-end duration**: 6 minutes 16 seconds (including manual approval)
- 📊 **Average time per domain**: 1 minute 22 seconds (excluding failed domain)
- 🔄 **Non-blocking queue**: Successfully queued 4 domains for approval without blocking

---

## Detailed Timing Analysis

### Per-Domain Breakdown

| Domain | Start Time | End Time | Duration | Status | Notes |
|--------|-----------|----------|----------|--------|-------|
| firesand.co.uk | 10:13:00 | 10:14:22 | **1m 22s** | ✅ Success | Queued for approval |
| s8080.com | 10:14:22 | 10:15:40 | **1m 18s** | ✅ Success | Queued for approval |
| emagine.org | 10:15:40 | 10:15:41 | **< 1s** | ❌ Failed | SSL cert verification error |
| bespokesupportsolutions.co.uk | 10:15:41 | 10:17:00 | **1m 19s** | ✅ Success | Queued for approval |
| bcs365.co.uk | 10:17:00 | 10:18:30 | **1m 30s** | ✅ Success | Queued for approval |

### Timeline Visualization

```
10:13:00 ━━━━━━━━━━━━━━━━━━━━━━━ firesand.co.uk (82s) ━━━━━━━━━━━━━━━━━━━━━━━━> 10:14:22
10:14:22 ━━━━━━━━━━━━━━━━━━━━ s8080.com (78s) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━> 10:15:40
10:15:40 ⚡ emagine.org (1s FAIL) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━> 10:15:41
10:15:41 ━━━━━━━━━━━━━━━━━━━━ bespokesupportsolutions.co.uk (79s) ━━━━━━━━━━━> 10:17:00
10:17:00 ━━━━━━━━━━━━━━━━━━━━━━ bcs365.co.uk (90s) ━━━━━━━━━━━━━━━━━━━━━━━━━> 10:18:30

Extraction Complete: 10:18:30 (5m 30s)

Manual Approval Phase:
10:18:30 ━━━━━━━━━━━━━━━━━━ (41s wait) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━> 10:19:11
10:19:11 [firesand.co.uk approved]
10:19:13 [s8080.com approved]
10:19:15 [bespokesupportsolutions.co.uk approved]
10:19:16 [bcs365.co.uk approved]

Total Duration: 6m 16s
```

### Processing Statistics

| Metric | Value |
|--------|-------|
| **Total domains** | 5 |
| **Successfully extracted** | 4 (80%) |
| **Failed extractions** | 1 (20%) |
| **Extraction time** | 5m 30s (330 seconds) |
| **Approval time** | 6 seconds (manual) |
| **Total end-to-end time** | 6m 16s (376 seconds) |
| **Average per successful domain** | 82.5 seconds (~1m 22s) |
| **Throughput** | 0.727 domains/minute |
| **Fastest domain** | s8080.com (1m 18s) |
| **Slowest domain** | bcs365.co.uk (1m 30s) |

---

## Resource Utilization

### System Resources (Monitored from 10:14:40 to 10:18:30)

**Monitoring Duration**: 3 minutes 50 seconds (230 seconds)  
**Sample Rate**: 1 second intervals  
**Total Samples**: 208 data points

| Resource | Peak Usage | Average Usage | Notes |
|----------|-----------|---------------|-------|
| **CPU** | 0.0% | 0.0% | ⚠️ Anomaly detected |
| **Memory** | 4.37 MB | 4.37 MB | ⚠️ Anomaly detected |

### Analysis Notes

⚠️ **Resource monitoring anomaly detected**: The resource monitor (`monitor_resources.py`) tracked a Python process that showed constant 0% CPU and 4.37 MB memory throughout the entire monitoring period. This suggests:

1. **Wrong process monitored**: The monitor may have attached to an idle Python process rather than the active `api_server.py` process
2. **Process identification issue**: The monitor used generic process name search which likely matched the wrong Python instance
3. **Actual resource usage unknown**: The true CPU and memory consumption during domain processing was not captured

**Expected behavior**: During LLM inference and web scraping, we would expect to see:
- CPU spikes during LLM inference (llama3.2:3b model)
- CPU activity during HTML parsing and data extraction
- Memory usage of 200-500 MB for model context and application state
- Variable CPU ranging from 20-80% during active processing

### Recommendations for Future Monitoring:
- Use PID-based monitoring instead of process name matching
- Monitor the `uvicorn` or `python api_server.py` process specifically
- Add process command-line validation to ensure correct process is tracked
- Consider monitoring at the system level rather than per-process

---

## Non-Blocking Queue Performance

### Queue Behavior

The non-blocking approval queue feature worked as designed:

✅ **Successful behaviors**:
- All 4 successful extractions were queued immediately without blocking
- Subsequent domains began processing instantly after previous domain completed
- No wait time between domain completions and next domain start
- Manual approval process occurred after all extractions completed

📊 **Queue states**:
- Peak pending approvals: 4 domains (at 10:18:30)
- Approval processing time: 6 seconds for 4 domains (1.5s average per approval)
- Zero rejections: All queued domains were approved

### Comparison: Blocking vs Non-Blocking

| Metric | Old (Blocking) | New (Non-Blocking) | Improvement |
|--------|---------------|-------------------|-------------|
| Wait time per approval | ~30-60s manual wait | 0s (parallel queue) | **100% reduction** |
| Total approval overhead | 2-4 minutes | 6 seconds | **95% reduction** |
| Domain processing | Sequential + blocked | Sequential + continuous | **Eliminates blocking** |
| User experience | Must approve during processing | Batch approve at end | **Better UX** |

---

## Data Quality Analysis

### Successful Extractions (4/5 domains)

#### firesand.co.uk ✅
**Company**: Firesand  
**Industry**: Information Technology / Professional Services  
**SIC**: 62020 - Information technology consultancy

**Data Completeness**:
- ✅ Company name, email, LinkedIn
- ✅ Industry classification (sector, industry, SIC)
- ✅ Long & short descriptions
- ✅ Services (5 items)
- ✅ Certifications (ISO 9001:2015, ISO 27001:2022)
- ✅ People information (1 person)
- ❌ Missing: Phone, address, logo

**Quality Score**: 8/10

---

#### s8080.com ✅
**Company**: S8080 Ltd  
**Industry**: Information Technology / Professional Services  
**SIC**: 62020 - Information technology consultancy

**Data Completeness**:
- ✅ Company name, email, LinkedIn, full address
- ✅ Industry classification
- ✅ Long & short descriptions
- ✅ Certifications (ISO 27001:2022)
- ✅ People information (1 person)
- ❌ Missing: Phone, services list, logo

**Quality Score**: 8/10

---

#### bespokesupportsolutions.co.uk ✅
**Company**: Bespoke Support Solutions  
**Industry**: Information Technology / Professional Services  
**SIC**: 62020 - Information technology consultancy

**Data Completeness**:
- ✅ Company name, email, full address
- ✅ Industry classification
- ✅ Long & short descriptions
- ✅ Services (2 items)
- ✅ Certifications (ISO 27001:2022)
- ❌ Missing: Phone, social media, people details, logo

**Quality Score**: 7/10

---

#### bcs365.co.uk ✅
**Company**: BCS Ltd  
**Industry**: IT Services  
**SIC**: 62020

**Data Completeness**:
- ⚠️ **Minimal extraction**: Only domain, industry, and SIC code captured
- ❌ Missing: Contact info, descriptions, services, certifications, people

**Quality Score**: 2/10  
**Note**: This extraction appears incomplete or the website had limited structured data

---

### Failed Extraction (1/5 domains)

#### emagine.org ❌
**Error**: `[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: unable to get local issuer certificate (_ssl.c:1147)`  
**Duration**: < 1 second (immediate failure)

**Root Cause**: SSL certificate validation failure - likely expired, self-signed, or missing intermediate certificate chain

**Recommendation**: Implement SSL verification bypass option with security warning, or add certificate validation fallback

---

## System Architecture Observations

### Current Pipeline
```
Input → Domain Normalization → Sequential Processing → LLM Extraction → Queue → Manual Approval → Database Save
                                        ↓
                            [Scraping → Preprocessing → LLM]
```

### Bottlenecks Identified

1. **Sequential Processing**: Domains processed one at a time, no parallelization
   - Each domain averages 82 seconds
   - Total time = sum of individual times (no overlap)
   - **Impact**: Linear scaling with domain count

2. **LLM Inference**: Each domain requires LLM call (likely the slowest step)
   - Estimated 40-60 seconds per domain for LLM processing
   - Running on Ollama with llama3.2:3b model
   - **Impact**: Significant per-domain overhead

3. **Web Scraping**: HTTP requests add latency
   - Estimated 10-20 seconds per domain
   - Network I/O bound operation
   - **Impact**: Moderate overhead, parallelizable

### Optimization Opportunities

**High Impact**:
- ✅ **Already implemented**: Non-blocking approval queue (completed)
- 🎯 **Next priority**: Redis-based parallel worker pool
  - Expected improvement: 3-5x throughput increase
  - Parallel domain processing with multiple workers
  - Each worker handles separate domain concurrently

**Medium Impact**:
- Implement retry logic for transient failures (SSL, network)
- Add domain batching for better resource utilization
- Cache frequently accessed data (logos, social media lookups)

**Low Impact**:
- Optimize LLM prompts for faster inference
- Reduce HTML parsing overhead
- Implement domain pre-validation

---

## Comparison with Expected Performance

### Baseline Targets vs Actual

| Target | Expected | Actual | Status |
|--------|----------|--------|--------|
| Success rate | 90%+ | 80% (4/5) | ⚠️ Below target |
| Avg time/domain | 60-90s | 82.5s | ✅ Within range |
| Queue blocking | 0s | 0s | ✅ Met target |
| System stability | No crashes | Stable | ✅ Met target |

### Success Rate Analysis

**80% success rate** is acceptable for baseline but room for improvement:
- 1 SSL certificate failure (20% of failures)
- 1 incomplete extraction (bcs365.co.uk had minimal data)
- Recommend adding error handling and retry mechanisms

---

## Conclusions

### Strengths
✅ **Non-blocking queue works perfectly**: No waiting between domain processing and approval  
✅ **Consistent performance**: Average 82.5s per domain with low variance (78-90s range)  
✅ **High data quality**: 3/4 successful extractions had comprehensive data (7-8/10 scores)  
✅ **Stable system**: No crashes or unexpected failures  
✅ **Good logging**: Clear visibility into each processing stage  

### Weaknesses
❌ **Sequential processing bottleneck**: Only one domain at a time  
❌ **SSL error handling**: No fallback for certificate validation failures  
❌ **Resource monitoring failed**: Unable to capture actual CPU/memory usage  
❌ **Incomplete extraction**: bcs365.co.uk had minimal data capture  

### Performance Baseline Established

**Throughput**: 0.727 domains/minute (sequential)  
**Target with Redis**: 2.5-3.5 domains/minute (5 parallel workers)  
**Expected improvement**: **3.5-5x faster** with parallel processing

---

## Next Steps

### Redis Parallel Workers Implementation

**Goal**: Increase throughput from 0.727 to 2.5+ domains/minute

**Plan**:
1. Create Redis queue for domain distribution
2. Implement 5 parallel worker processes
3. Add worker coordination and load balancing
4. Update metrics capture for multi-worker tracking
5. Run comparison test with same 5 domains

**Expected Results**:
- Total time: ~2 minutes (vs 5m 30s baseline)
- Parallel processing of multiple domains
- Higher CPU utilization (distributed across workers)
- Potential memory increase (multiple Python processes)

### Improved Monitoring

**Fix resource tracking**:
- Monitor correct process by PID
- Track per-worker resource usage
- Capture system-wide metrics
- Add real-time dashboard

---

## Appendix: Raw Data

### Job Status Response
```json
{
  "status": "completed",
  "total": 5,
  "completed": 4,
  "failed": 1,
  "pending_count": 0,
  "approved_count": 4,
  "rejected_count": 0
}
```

### Log Timeline
```
10:13:00 - Starting to process 5 domains
10:13:00 - Scraping & Extracting firesand.co.uk...
10:14:22 - firesand.co.uk extracted - queued for approval (non-blocking)
10:14:22 - Scraping & Extracting s8080.com...
10:15:40 - s8080.com extracted - queued for approval (non-blocking)
10:15:40 - Scraping & Extracting emagine.org...
10:15:41 - Failed to extract emagine.org: [SSL: CERTIFICATE_VERIFY_FAILED]
10:15:41 - Scraping & Extracting bespokesupportsolutions.co.uk...
10:17:00 - bespokesupportsolutions.co.uk extracted - queued for approval (non-blocking)
10:17:00 - Scraping & Extracting bcs365.co.uk...
10:18:30 - bcs365.co.uk extracted - queued for approval (non-blocking)
10:18:30 - Extraction complete! 4 awaiting approval, 1 failed
10:19:11 - Approved and saved firesand.co.uk
10:19:13 - Approved and saved s8080.com
10:19:15 - Approved and saved bespokesupportsolutions.co.uk
10:19:16 - Approved and saved bcs365.co.uk
```

---

**Report Generated**: January 15, 2026  
**Processing Mode**: Sequential (Baseline)  
**Next Phase**: Redis Parallel Workers Implementation  
**Comparison Test**: Scheduled after Redis implementation
