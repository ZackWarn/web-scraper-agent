# Redis Parallel Processing UI Integration Guide

## Overview

This guide explains how to integrate the Redis parallel worker processing with the existing Next.js UI. The UI will display real-time parallel processing status, worker metrics, and performance comparisons.

---

## Architecture

### Current Setup
- **Frontend:** Next.js 16 (TypeScript + Tailwind)
- **Backend API:** FastAPI (port 8000)
- **Queue:** Redis (port 6379)
- **Workers:** 5 × redis_worker.py processes

### Data Flow

```
UI (Domains Input)
    ↓
API (/api/process_redis) → Redis Queue
    ↓
5 Parallel Workers
    ↓
Database (SQLite)
    ↓
API (/api/status/{job_id}) → UI Updates (polling)
    ↓
UI (Status Display + Results)
```

---

## New UI Components Required

### 1. **ParallelJobMonitor.tsx**
Displays real-time parallel processing status for 5 workers

```tsx
interface ParallelJobMonitorProps {
  jobId: string;
  workerCount: number;
  onComplete: () => void;
}

// Features:
// - Show 5 worker status boxes (running/idle/complete)
// - Per-worker progress bars
// - Domain processing timeline
// - Real-time metrics updates
// - Completion percentage
```

### 2. **WorkerStatusPanel.tsx**
Individual worker status display

```tsx
interface WorkerStatusPanelProps {
  workerId: string;
  domain: string;
  status: "idle" | "processing" | "complete" | "error";
  progress: number; // 0-100
  duration: string;
  error?: string;
}

// Features:
// - Worker name/ID
// - Current domain processing
// - Progress indicator
// - Time elapsed
// - Error display (if any)
```

### 3. **PerformanceComparison.tsx**
Side-by-side comparison of sequential vs parallel

```tsx
interface PerformanceComparisonProps {
  sequentialTime: number; // milliseconds
  parallelTime: number; // milliseconds
  domainCount: number;
}

// Features:
// - Speedup factor display
// - Time saved calculation
// - Visual comparison bars
// - Performance metrics
```

### 4. **BatchJobSubmit.tsx**
Enhanced domain input for batch processing

```tsx
interface BatchJobSubmitProps {
  onSubmit: (domains: string[], processingMode: "sequential" | "parallel") => void;
  maxDomains?: number;
}

// Features:
// - Batch domain input (CSV or textarea)
// - Processing mode selector
// - Domain validation
// - Worker count selector (3-10 workers)
// - Estimated time display
```

### 5. **JobHistoryPanel.tsx**
Display previous jobs and statistics

```tsx
interface JobHistoryPanelProps {
  jobs: JobRecord[];
}

// Features:
// - Previous job list
// - Success/failure stats
// - Processing time comparison
// - Performance trends
```

---

## Implementation Steps

### Step 1: Create Worker Status Component

File: `ui/components/WorkerStatusPanel.tsx`

```tsx
"use client";

interface WorkerStatusPanelProps {
  workerId: string;
  domain?: string;
  status: "idle" | "processing" | "complete" | "error";
  progress: number;
  duration: string;
  error?: string;
}

export default function WorkerStatusPanel({
  workerId,
  domain,
  status,
  progress,
  duration,
  error,
}: WorkerStatusPanelProps) {
  const statusColors = {
    idle: "bg-gray-100 border-gray-300",
    processing: "bg-blue-50 border-blue-300",
    complete: "bg-green-50 border-green-300",
    error: "bg-red-50 border-red-300",
  };

  const statusIcons = {
    idle: "⏸️",
    processing: "⚙️",
    complete: "✅",
    error: "❌",
  };

  return (
    <div
      className={`border-2 rounded-lg p-4 ${statusColors[status]}`}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-lg">
          {statusIcons[status]} {workerId}
        </h3>
        <span className="text-sm text-gray-600">{duration}</span>
      </div>

      {domain && (
        <p className="text-sm text-gray-700 mb-3">
          <span className="font-semibold">Domain:</span> {domain}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 mb-3">
          <span className="font-semibold">Error:</span> {error}
        </p>
      )}

      <div className="w-full bg-gray-300 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all ${
            status === "error"
              ? "bg-red-500"
              : status === "complete"
                ? "bg-green-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-gray-600 mt-2">{progress}%</p>
    </div>
  );
}
```

### Step 2: Create Parallel Job Monitor

File: `ui/components/ParallelJobMonitor.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import WorkerStatusPanel from "./WorkerStatusPanel";

interface WorkerStatus {
  id: string;
  domain?: string;
  status: "idle" | "processing" | "complete" | "error";
  progress: number;
  duration: number; // seconds
  error?: string;
}

interface ParallelJobMonitorProps {
  jobId: string;
  workerCount: number;
  onComplete: () => void;
}

export default function ParallelJobMonitor({
  jobId,
  workerCount,
  onComplete,
}: ParallelJobMonitorProps) {
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [jobStats, setJobStats] = useState<any>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  // Initialize workers
  useEffect(() => {
    setWorkers(
      Array.from({ length: workerCount }, (_, i) => ({
        id: `Worker-${i + 1}`,
        status: "idle",
        progress: 0,
        duration: 0,
      }))
    );
  }, [workerCount]);

  // Poll job status
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status/${jobId}`);
        const data = await res.json();

        setJobStats(data);

        // Update worker statuses based on job results
        if (data.results) {
          const updatedWorkers = workers.map((worker, idx) => {
            const result = data.results[idx];
            return {
              ...worker,
              domain: result?.domain,
              status: result ? "complete" : "idle",
              progress: result ? 100 : 0,
              duration: result?.duration || 0,
              error: result?.error,
            };
          });
          setWorkers(updatedWorkers);
        }

        if (data.status === "completed") {
          setIsCompleted(true);
          onComplete();
        }
      } catch (error) {
        console.error("Error fetching job status:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [jobId]);

  const completedCount = workers.filter((w) => w.status === "complete").length;
  const failedCount = workers.filter((w) => w.status === "error").length;
  const totalTime = Math.max(...workers.map((w) => w.duration), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Domains</p>
          <p className="text-3xl font-bold text-blue-600">
            {jobStats?.total || 0}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {jobStats?.completed || 0}
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Time</p>
          <p className="text-3xl font-bold text-orange-600">
            {Math.floor(totalTime / 60)}m {(totalTime % 60).toFixed(0)}s
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4">Worker Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {workers.map((worker) => (
            <WorkerStatusPanel
              key={worker.id}
              workerId={worker.id}
              domain={worker.domain}
              status={worker.status}
              progress={worker.progress}
              duration={`${worker.duration.toFixed(1)}s`}
              error={worker.error}
            />
          ))}
        </div>
      </div>

      {isCompleted && (
        <div className="bg-green-100 border border-green-400 rounded-lg p-4">
          <p className="text-green-800 font-bold">✅ Job Completed!</p>
          <p className="text-green-700 text-sm">
            {jobStats?.completed} of {jobStats?.total} domains successfully
            processed.
          </p>
        </div>
      )}
    </div>
  );
}
```

### Step 3: Create Batch Job Submission

File: `ui/components/BatchJobSubmit.tsx`

```tsx
"use client";

import { useState } from "react";

interface BatchJobSubmitProps {
  onSubmit: (
    domains: string[],
    processingMode: "sequential" | "parallel"
  ) => void;
  isProcessing: boolean;
}

export default function BatchJobSubmit({
  onSubmit,
  isProcessing,
}: BatchJobSubmitProps) {
  const [domainText, setDomainText] = useState("");
  const [processingMode, setProcessingMode] = useState<"sequential" | "parallel">(
    "parallel"
  );
  const [workerCount, setWorkerCount] = useState(5);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Parse domains (comma or newline separated)
    const domains = domainText
      .split(/[\n,]/)
      .map((d) => d.trim())
      .filter((d) => d.length > 0 && d.includes("."));

    if (domains.length === 0) {
      alert("Please enter at least one valid domain");
      return;
    }

    onSubmit(domains, processingMode);
  };

  const domainCount = domainText
    .split(/[\n,]/)
    .filter((d) => d.trim().length > 0 && d.includes(".")).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold mb-2">
          Domains (one per line or comma-separated):
        </label>
        <textarea
          value={domainText}
          onChange={(e) => setDomainText(e.target.value)}
          placeholder="example.com
google.com
github.com"
          className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm"
          disabled={isProcessing}
        />
        <p className="text-xs text-gray-500 mt-1">
          {domainCount} valid domains detected
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2">
            Processing Mode:
          </label>
          <select
            value={processingMode}
            onChange={(e) =>
              setProcessingMode(e.target.value as "sequential" | "parallel")
            }
            className="w-full p-2 border border-gray-300 rounded-lg"
            disabled={isProcessing}
          >
            <option value="sequential">Sequential (1 worker)</option>
            <option value="parallel">Parallel (Multiple workers)</option>
          </select>
        </div>

        {processingMode === "parallel" && (
          <div>
            <label className="block text-sm font-bold mb-2">
              Worker Count:
            </label>
            <select
              value={workerCount}
              onChange={(e) => setWorkerCount(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-lg"
              disabled={isProcessing}
            >
              {[3, 5, 10, 15, 20].map((count) => (
                <option key={count} value={count}>
                  {count} workers
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {processingMode === "parallel" && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💡 <strong>Estimated time:</strong> ~{Math.ceil(domainCount / workerCount * 3.5 / workerCount)} minutes
            with {workerCount} workers (vs ~{Math.ceil(domainCount * 3.5 / 60)} minutes sequential)
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || domainCount === 0}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isProcessing ? "Processing..." : `Submit ${domainCount} Domains`}
      </button>
    </form>
  );
}
```

### Step 4: Create Performance Comparison

File: `ui/components/PerformanceComparison.tsx`

```tsx
"use client";

interface PerformanceComparisonProps {
  sequentialTime: number; // seconds
  parallelTime: number; // seconds
  domainCount: number;
}

export default function PerformanceComparison({
  sequentialTime,
  parallelTime,
  domainCount,
}: PerformanceComparisonProps) {
  const speedup = sequentialTime / parallelTime;
  const timeSaved = sequentialTime - parallelTime;
  const percentFaster = ((timeSaved / sequentialTime) * 100).toFixed(1);

  const maxTime = Math.max(sequentialTime, parallelTime);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Performance Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sequential */}
        <div className="border border-gray-300 rounded-lg p-4">
          <h4 className="font-bold text-lg mb-3">Sequential (1 worker)</h4>
          <div className="space-y-2 mb-4">
            <p className="text-gray-700">
              <span className="font-semibold">Time:</span>{" "}
              {Math.floor(sequentialTime / 60)}m {(sequentialTime % 60).toFixed(0)}s
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Throughput:</span>{" "}
              {(domainCount / (sequentialTime / 60)).toFixed(2)} domains/min
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-8">
            <div
              className="bg-gray-500 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ width: "100%" }}
            >
              {Math.floor(sequentialTime / 60)}m
            </div>
          </div>
        </div>

        {/* Parallel */}
        <div className="border border-green-300 rounded-lg p-4 bg-green-50">
          <h4 className="font-bold text-lg mb-3 text-green-700">
            Parallel (5 workers)
          </h4>
          <div className="space-y-2 mb-4">
            <p className="text-gray-700">
              <span className="font-semibold">Time:</span>{" "}
              {Math.floor(parallelTime / 60)}m {(parallelTime % 60).toFixed(0)}s
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Throughput:</span>{" "}
              {(domainCount / (parallelTime / 60)).toFixed(2)} domains/min
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-8">
            <div
              className="bg-green-500 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ width: `${(parallelTime / maxTime) * 100}%` }}
            >
              {Math.floor(parallelTime / 60)}m
            </div>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-green-300 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-gray-600 text-sm">Speedup</p>
            <p className="text-3xl font-bold text-green-600">{speedup.toFixed(1)}x</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">Time Saved</p>
            <p className="text-3xl font-bold text-blue-600">
              {Math.floor(timeSaved / 60)}m
            </p>
          </div>
          <div>
            <p className="text-gray-600 text-sm">% Faster</p>
            <p className="text-3xl font-bold text-orange-600">{percentFaster}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Update Main Page

File: `ui/app/page.tsx` (modify existing)

```tsx
"use client";

import { useState, useEffect } from "react";
import DomainInput from "@/components/DomainInput";
import BatchJobSubmit from "@/components/BatchJobSubmit";
import ParallelJobMonitor from "@/components/ParallelJobMonitor";
import PerformanceComparison from "@/components/PerformanceComparison";
import CompanyGrid from "@/components/CompanyGrid";
import GraphVisualization from "@/components/GraphVisualization";
import StatsCard from "@/components/StatsCard";

export default function Home() {
  const [activeTab, setActiveTab] = useState<
    "input" | "parallel" | "companies" | "comparison"
  >("input");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState<any>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [processingMode, setProcessingMode] = useState<"sequential" | "parallel">(
    "parallel"
  );
  const [jobMetrics, setJobMetrics] = useState<any>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const handleBatchSubmit = async (
    domains: string[],
    mode: "sequential" | "parallel"
  ) => {
    setProcessingMode(mode);
    setIsProcessing(true);

    try {
      const endpoint =
        mode === "parallel" ? "/api/process_redis" : "/api/process";

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains }),
      });

      const data = await res.json();
      setJobId(data.job_id);

      if (mode === "parallel") {
        setActiveTab("parallel");
      }
    } catch (error) {
      console.error("Error submitting job:", error);
      setIsProcessing(false);
    }
  };

  const handleJobComplete = async () => {
    setIsProcessing(false);

    // Fetch job metrics
    const res = await fetch(`${API_BASE}/api/status/${jobId}`);
    const metrics = await res.json();
    setJobMetrics(metrics);

    // Fetch updated companies
    fetchCompanies();

    setActiveTab("companies");
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/companies`);
      const data = await res.json();
      setCompanies(data.companies);
    } catch (error) {
      console.error("Error fetching companies:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stats`);
      const data = await res.json();
      setStats(data);
      setApiOnline(true);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setApiOnline(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 10000);
    if (activeTab === "companies") {
      fetchCompanies();
    }
    return () => clearInterval(id);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🕷️ Web Scraper Agent
          </h1>
          <p className="text-gray-600">
            Parallel domain processing with Redis workers
          </p>
        </div>
      </header>

      {/* API Status */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        {apiOnline ? (
          <div className="bg-green-100 text-green-800 p-2 rounded text-sm">
            ✅ API Online | Redis: Running | Workers: Ready
          </div>
        ) : (
          <div className="bg-red-100 text-red-800 p-2 rounded text-sm">
            ❌ API Offline
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 mb-6">
          {[
            { id: "input", label: "📤 Submit Job" },
            { id: "parallel", label: "⚙️ Parallel Monitor", visible: isProcessing || jobId },
            { id: "companies", label: "🏢 Results" },
            { id: "comparison", label: "📊 Performance" },
          ].map(
            (tab) =>
              tab.visible !== false && (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(tab.id as typeof activeTab)
                  }
                  className={`px-4 py-2 rounded-lg font-bold transition ${
                    activeTab === tab.id
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              )
          )}
        </div>

        {/* Content */}
        {activeTab === "input" && (
          <div className="bg-white rounded-lg shadow p-6">
            <BatchJobSubmit
              onSubmit={handleBatchSubmit}
              isProcessing={isProcessing}
            />
          </div>
        )}

        {activeTab === "parallel" && jobId && (
          <div className="bg-white rounded-lg shadow p-6">
            <ParallelJobMonitor
              jobId={jobId}
              workerCount={processingMode === "parallel" ? 5 : 1}
              onComplete={handleJobComplete}
            />
          </div>
        )}

        {activeTab === "companies" && (
          <div className="bg-white rounded-lg shadow p-6">
            <CompanyGrid companies={companies} />
          </div>
        )}

        {activeTab === "comparison" && jobMetrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <PerformanceComparison
              sequentialTime={jobMetrics.estimated_sequential_time || 0}
              parallelTime={jobMetrics.actual_parallel_time || 0}
              domainCount={jobMetrics.total || 0}
            />
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## API Integration Requirements

### Expected Endpoints

1. **POST /api/process_redis**
   ```json
   Request: { "domains": ["example.com", "test.com"] }
   Response: { "job_id": "uuid", "status": "queued" }
   ```

2. **GET /api/status/{job_id}**
   ```json
   Response: {
     "status": "processing|completed",
     "total": 5,
     "completed": 3,
     "failed": 1,
     "pending_count": 1,
     "results": [
       {
         "domain": "example.com",
         "status": "success",
         "duration": 120,
         "error": null
       }
     ],
     "start_time": "2026-01-16T20:36:29",
     "end_time": "2026-01-16T20:42:36"
   }
   ```

3. **GET /api/companies**
   ```json
   Response: {
     "companies": [...],
     "total": 17
   }
   ```

---

## Real-Time Updates Strategy

### Polling vs WebSocket

**Current Implementation: Polling (Recommended for MVP)**

- **Interval:** 2 seconds during job processing
- **Benefit:** Simple, no server infrastructure needed
- **Trade-off:** Slight latency (up to 2 seconds)

**Future Enhancement: WebSocket**

```tsx
// For real-time updates without polling
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:8000/ws/job/${jobId}`);

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    setWorkers(data.workers);
  };

  return () => ws.close();
}, [jobId]);
```

---

## Component Usage Examples

### Example 1: Simple Batch Submit

```tsx
<BatchJobSubmit
  onSubmit={(domains, mode) => {
    console.log("Processing:", domains, "with mode:", mode);
  }}
  isProcessing={false}
/>
```

### Example 2: Monitor Running Job

```tsx
<ParallelJobMonitor
  jobId="1450a661-19ce-4f32-9d4d-80702ffcbfcf"
  workerCount={5}
  onComplete={() => console.log("Job done!")}
/>
```

### Example 3: Show Performance Data

```tsx
<PerformanceComparison
  sequentialTime={1050} // 17.5 minutes in seconds
  parallelTime={367} // 6m 7s in seconds
  domainCount={5}
/>
```

---

## Styling Enhancements

### Tailwind Classes Used

- **Status indicators:** `bg-green-50`, `bg-blue-50`, `bg-red-50`
- **Progress bars:** `bg-gradient-to-r`, `rounded-full`
- **Cards:** `border-2`, `rounded-lg`, `shadow`
- **Typography:** `font-bold`, `text-lg`, `text-gray-600`

### Dark Mode Support (Optional)

```tsx
// Add to component classNames
className={`${
  isDark ? "dark:bg-slate-800 dark:text-white" : ""
} ...existing classes`}
```

---

## Testing Recommendations

### Manual Testing Checklist

- [ ] Submit 3 domains with parallel mode
- [ ] Verify all 5 workers show status
- [ ] Verify real-time updates every 2 seconds
- [ ] Verify job completion
- [ ] Verify results displayed in company grid
- [ ] Submit 10 domains with parallel mode
- [ ] Test with sequential mode (1 worker)
- [ ] Test error handling (invalid domains)
- [ ] Test performance comparison display

### Performance Testing

```bash
# Submit 20 domains for stress testing
curl -X POST http://localhost:8000/api/process_redis \
  -H "Content-Type: application/json" \
  -d '{"domains": [...]}'
```

---

## Deployment Considerations

### Production Checklist

1. **API Rate Limiting**
   - Add rate limiting to `/api/process_redis`
   - Limit to 10 jobs per minute per IP

2. **Error Handling**
   - Catch API connection errors
   - Display user-friendly error messages
   - Implement retry logic

3. **Data Persistence**
   - Store job history in database
   - Allow users to view past jobs

4. **Monitoring**
   - Add application logging
   - Track API response times
   - Monitor worker health

5. **Security**
   - Validate domain input (prevent injection)
   - Add authentication/authorization
   - Rate limit per user

---

## Future Enhancements

1. **Advanced Metrics**
   - Worker resource usage (CPU, memory)
   - Network bandwidth tracking
   - LLM inference time breakdown

2. **Smart Batching**
   - Automatic worker count recommendation
   - Domain complexity estimation
   - Estimated time to completion

3. **Export Features**
   - Export results as CSV
   - Generate performance reports
   - Download job logs

4. **Scheduling**
   - Schedule jobs for off-peak hours
   - Recurring job support
   - Job prioritization

5. **Advanced Visualization**
   - Real-time timeline chart
   - Worker utilization heatmap
   - Performance trend graphs

---

**Implementation Status:** Ready to Code  
**Estimated Implementation Time:** 2-3 hours  
**Difficulty Level:** Medium
