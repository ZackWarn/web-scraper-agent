"use client";

import { useState, useEffect, useRef } from "react";

interface WorkerStatus {
  id: string;
  domain?: string;
  status: "idle" | "processing" | "complete" | "error";
  progress: number;
  duration: number;
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
  const [progress, setProgress] = useState(0);
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

  // Poll for status updates using HTTP instead of WebSocket
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/status/${jobId}`);
        if (!response.ok) {
          console.error("Failed to fetch status");
          return;
        }
        
        const data = await response.json();
        setJobStats(data);
        
        // Debug: Log the data to console
        console.log("Job Status:", data);
        
        // Update progress
        if (data.progress_percentage !== undefined) {
          setProgress(data.progress_percentage);
        }

        // Update worker statuses from API
        if (data.workers && Array.isArray(data.workers)) {
          const updatedWorkers = workers.map((worker, idx) => {
            const apiWorker = data.workers[idx];
            if (apiWorker) {
              return {
                id: apiWorker.worker_id || worker.id,
                domain: apiWorker.domain,
                status: apiWorker.status || "idle",
                progress: apiWorker.progress || 0,
                duration: 0,
                error: undefined,
              };
            }
            return worker;
          });
          setWorkers(updatedWorkers);
        } else if (data.logs && data.logs.length > 0) {
          // Fallback: Update based on logs
          const completedDomains = data.logs.filter((log: any) => 
            log.message.includes("✅") || log.message.includes("❌")
          );

          const updatedWorkers = workers.map((worker, idx) => {
            const log = completedDomains[idx];
            if (log) {
              const domain = log.message.split(" ")[1] || "";
              const isError = log.message.includes("❌");
              const errorMsg = isError ? log.message.split(": ").slice(1).join(": ") : undefined;

              return {
                ...worker,
                domain,
                status: isError ? ("error" as const) : ("complete" as const),
                progress: 100,
                duration: 0,
                error: errorMsg,
              };
            }
            return worker;
          });

          setWorkers(updatedWorkers);
        }

        // Check if job completed
        if (data.status === "completed") {
          setIsCompleted(true);
          clearInterval(pollInterval);
          setTimeout(onComplete, 1500);
        }
      } catch (error) {
        console.error("Error fetching status:", error);
      }
    }, 1000); // Poll every second

    return () => clearInterval(pollInterval);
  }, [jobId, API_BASE, onComplete]);

  const completedCount = workers.filter((w) => w.status === "complete").length;
  const failedCount = workers.filter((w) => w.status === "error").length;
  const totalTime = Math.max(...workers.map((w) => w.duration), 0);

  return (
    <div className="space-y-6">
      {/* Overall Progress Bar */}
      <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800">
            {isCompleted ? "✅ Processing Complete" : "⚙️ Processing in Progress..."}
          </h3>
          <span className="text-sm font-bold text-blue-600">{progress}%</span>
        </div>
        
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-blue-500 to-blue-600 h-full transition-all duration-300 ease-out flex items-center justify-end pr-2"
              style={{ width: `${progress}%` }}
            >
              {progress > 10 && (
                <span className="text-xs text-white font-bold">{progress}%</span>
              )}
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {jobStats?.completed || 0} / {jobStats?.total || 0} domains completed
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-gray-800 font-semibold">Total Domains</p>
          <p className="text-3xl font-bold text-blue-600">
            {jobStats?.total || 0}
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-gray-800 font-semibold">Completed</p>
          <p className="text-3xl font-bold text-green-600">
            {jobStats?.completed || 0}
          </p>
        </div>

        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-gray-800 font-semibold">Total Time</p>
          <p className="text-3xl font-bold text-orange-600">
            {Math.floor(totalTime / 60)}m {(totalTime % 60).toFixed(0)}s
          </p>
        </div>
      </div>

      {/* Real-time Logs (moved up for visibility) */}
      <div className="bg-white rounded-lg shadow-lg p-4 border border-gray-200">
        <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
          <span>📋</span> Activity Logs
        </h3>
        <div className="bg-gray-900 text-gray-100 rounded-lg p-4 max-h-80 overflow-y-auto font-mono text-sm">
          {(!jobStats?.logs || jobStats.logs.length === 0) ? (
            <div className="text-gray-500">Waiting for processing to start...</div>
          ) : (
            <div className="space-y-1">
              {jobStats.logs.map((log: any, idx: number) => (
                <div key={idx} className={`px-2 py-1 rounded ${
                  log.level === "success" ? "bg-green-900/30" :
                  log.level === "error" ? "bg-red-900/30" :
                  log.level === "warning" ? "bg-yellow-900/30" :
                  "bg-blue-900/30"
                }`}>
                  <span className="text-gray-400 text-xs">[{log.timestamp}]</span>{" "}
                  <span className={
                    log.level === "success" ? "text-green-400" :
                    log.level === "error" ? "text-red-400" :
                    log.level === "warning" ? "text-yellow-400" :
                    "text-blue-300"
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        {jobStats?.logs && jobStats.logs.length > 20 && (
          <div className="text-xs text-gray-500 mt-2 text-center">
            Showing all {jobStats.logs.length} events
          </div>
        )}
      </div>

      {/* Worker Status Grid */}
      <div>
        <h3 className="text-lg font-bold mb-4">Individual Worker Progress</h3>
        
        {/* Worker Progress Bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {workers.map((worker) => (
            <div key={worker.id} className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700">
                  {worker.id}
                </span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  worker.status === "processing"
                    ? "bg-blue-100 text-blue-700"
                    : worker.status === "complete"
                    ? "bg-green-100 text-green-700"
                    : worker.status === "error"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {worker.status}
                </span>
              </div>
              {worker.domain && (
                <div className="text-xs text-gray-600 mb-2 truncate" title={worker.domain}>
                  📄 {worker.domain}
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      worker.status === "complete"
                        ? "bg-green-500"
                        : worker.status === "error"
                        ? "bg-red-500"
                        : "bg-blue-500"
                    }`}
                    style={{ width: `${worker.progress}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-gray-700 w-10 text-right">
                  {worker.progress}%
                </span>
              </div>
              {worker.error && (
                <div className="text-xs text-red-600 mt-1 truncate" title={worker.error}>
                  ⚠️ {worker.error}
                </div>
              )}
            </div>
          ))}
        </div>
        
      </div>


      {/* Completion Message */}
      {isCompleted && (
        <div className="bg-green-100 border border-green-400 rounded-lg p-4">
          <p className="text-green-800 font-bold">✅ Job Completed!</p>
          <p className="text-green-700 text-sm">
            {jobStats?.completed} of {jobStats?.total} domains successfully processed
            {jobStats?.failed > 0 && ` (${jobStats.failed} failed)`}.
          </p>
        </div>
      )}
    </div>
  );
}
