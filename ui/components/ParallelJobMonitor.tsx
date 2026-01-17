"use client";

import { useState, useEffect, useRef } from "react";
import WorkerStatusPanel from "./WorkerStatusPanel";

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
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const WS_BASE = API_BASE.replace("http://", "ws://").replace("https://", "wss://");

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

  // WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${WS_BASE}/ws/job/${jobId}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected");
          setConnectionStatus("connected");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.error) {
              console.error("WebSocket error:", data.error);
              setConnectionStatus("error");
              return;
            }

            setJobStats(data);

            // Update worker statuses based on results
            if (data.logs && data.logs.length > 0) {
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
                    status: isError ? "error" : "complete",
                    progress: 100,
                    duration: data.metrics?.duration || 0,
                    error: errorMsg,
                  };
                }
                return worker;
              });

              setWorkers(updatedWorkers);
            }

            // Check if job completed
            if (data.status === "completed" || data.status === "waiting_approval") {
              setIsCompleted(true);
              ws.close();
              onComplete();
            }
          } catch (error) {
            console.error("Error parsing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setConnectionStatus("error");
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected");
          setConnectionStatus("disconnected");
          
          // Attempt to reconnect if not completed
          if (!isCompleted) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log("Attempting to reconnect...");
              connectWebSocket();
            }, 3000);
          }
        };
      } catch (error) {
        console.error("Error creating WebSocket:", error);
        setConnectionStatus("error");
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [jobId, isCompleted]);

  const completedCount = workers.filter((w) => w.status === "complete").length;
  const failedCount = workers.filter((w) => w.status === "error").length;
  const totalTime = Math.max(...workers.map((w) => w.duration), 0);

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <div className={`text-sm px-3 py-1 rounded inline-block ${
        connectionStatus === "connected" ? "bg-green-100 text-green-800" :
        connectionStatus === "connecting" ? "bg-yellow-100 text-yellow-800" :
        connectionStatus === "error" ? "bg-red-100 text-red-800" :
        "bg-gray-100 text-gray-800"
      }`}>
        {connectionStatus === "connected" && "🟢 Live Updates"}
        {connectionStatus === "connecting" && "🟡 Connecting..."}
        {connectionStatus === "error" && "🔴 Connection Error"}
        {connectionStatus === "disconnected" && "⚪ Disconnected"}
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

      {/* Worker Status Grid */}
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

      {/* Real-time Logs */}
      {jobStats?.logs && jobStats.logs.length > 0 && (
        <div>
          <h3 className="text-lg font-bold mb-2">Activity Log</h3>
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
            {jobStats.logs.slice(-10).map((log: any, idx: number) => (
              <div key={idx} className="mb-1">
                <span className="text-gray-500">[{log.timestamp}]</span>{" "}
                <span className={
                  log.level === "success" ? "text-green-400" :
                  log.level === "error" ? "text-red-400" :
                  log.level === "warning" ? "text-yellow-400" :
                  "text-gray-300"
                }>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
