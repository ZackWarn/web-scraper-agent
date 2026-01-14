"use client";

import { useEffect, useState, useRef } from "react";

interface ProcessingStatusProps {
  jobId: string;
  onComplete: () => void;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "success" | "error" | "warning";
  message: string;
}

export default function ProcessingStatus({
  jobId,
  onComplete,
}: ProcessingStatusProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [queueCounts, setQueueCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
  const [preview, setPreview] = useState<{ domain: string; data: any } | null>(null);
  const [pendingList, setPendingList] = useState<{ domain: string; data: any }[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [decision, setDecision] = useState<Record<string, "accepted" | "rejected">>({});
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of logs container only (not the whole page)
  useEffect(() => {
    if (logsContainerRef.current && logsEndRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/status/${jobId}`);
        const data = await res.json();

        setQueueCounts({
          pending: data.pending_count ?? 0,
          approved: data.approved_count ?? 0,
          rejected: data.rejected_count ?? 0,
        });

        // Update worker status
        if (data.status) {
          if (data.status === "completed") {
            setWorkerStatus("completed");
          } else if (data.current_domain) {
            setWorkerStatus(`processing: ${data.current_domain}`);
          } else {
            setWorkerStatus("queued");
          }
        }

        // Choose a pending approval to preview: prefer the first pending domain
        // Build pending approvals list
        if (data.pending_approvals && typeof data.pending_approvals === "object") {
          const entries = Object.entries(data.pending_approvals).map(([domain, payload]) => ({ domain, data: payload }));
          setPendingList(entries);

          // Maintain or assign selection
          if (entries.length === 0) {
            setSelectedDomain(null);
            setPreview(null);
          } else {
            const current = entries.find((e) => e.domain === selectedDomain) || entries[0];
            setSelectedDomain(current.domain);
            setPreview(current);
          }
        } else if (data.last_extracted && data.last_extracted.domain) {
          setPendingList([]);
          setSelectedDomain(data.last_extracted.domain);
          setPreview(data.last_extracted);
        }

        // Add new logs from status
        if (data.logs && Array.isArray(data.logs)) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.timestamp + l.message));
            const newLogs = data.logs.filter(
              (l: LogEntry) => !existingIds.has(l.timestamp + l.message)
            );
            return [...prev, ...newLogs];
          });
        }

        if (data.status === "completed") {
          setIsCompleted(true);
          clearInterval(interval);
          setTimeout(onComplete, 1500);
        }
      } catch (error) {
        console.error("Error fetching status:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [jobId, onComplete, selectedDomain]);

  const getLogColor = (level: string) => {
    switch (level) {
      case "success":
        return "text-green-600 bg-green-50";
      case "error":
        return "text-red-600 bg-red-50";
      case "warning":
        return "text-yellow-600 bg-yellow-50";
      default:
        return "text-blue-600 bg-blue-50";
    }
  };

  const getLogIcon = (level: string) => {
    switch (level) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const acceptPreview = async (accept: boolean) => {
    if (!preview) return;
    try {
      const res = await fetch(`${API_BASE}/api/accept_extracted`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, domain: preview.domain, accept }),
      });
      if (!res.ok) {
        throw new Error(`Accept API error ${res.status}`);
      }
      setDecision((d) => ({ ...d, [preview.domain]: accept ? "accepted" : "rejected" }));
    } catch (err) {
      console.error("Error recording decision:", err);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">
            {isCompleted ? "✅ Processing Complete" : "⚙️ Processing in Progress..."}
          </h3>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm text-gray-500">Job: {jobId.slice(0, 8)}</span>
            <span className={`text-xs px-3 py-1 rounded-full font-medium ${
              workerStatus === "completed"
                ? "bg-green-100 text-green-700"
                : workerStatus.startsWith("processing")
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-700"
            }`}>
              🔧 Worker: {workerStatus}
            </span>
          </div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded">Pending: {queueCounts.pending}</span>
          <span className="px-2 py-1 bg-green-50 text-green-700 rounded">Approved: {queueCounts.approved}</span>
          <span className="px-2 py-1 bg-red-50 text-red-700 rounded">Rejected: {queueCounts.rejected}</span>
        </div>
      </div>

      {/* Real-time log display - with scrollbar gutter to prevent layout shift */}
      <div ref={logsContainerRef} className="bg-gray-900 rounded-lg p-4 font-mono text-xs text-gray-100 h-80 border border-gray-700" style={{ overflowY: "scroll" }}>
        {logs.length === 0 ? (
          <div className="text-gray-500">Waiting for processing to start...</div>
        ) : (
          <div className="space-y-1 pr-2">
            {logs.map((log, idx) => (
              <div key={idx} className={`${getLogColor(log.level)} px-3 py-1 rounded flex items-start gap-2`}>
                <span className="flex-shrink-0">{getLogIcon(log.level)}</span>
                <div className="flex-1">
                  <span className="text-gray-500 text-xs">[{log.timestamp}]</span>
                  <span className="ml-2">{log.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending approvals queue */}
      {pendingList.length > 0 && (
        <div className="mt-4 border border-blue-200 rounded-lg bg-blue-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold text-blue-800">Pending Approvals Queue</div>
            <div className="text-xs text-blue-700">{pendingList.length} awaiting decision</div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingList.map((item) => (
              <button
                key={item.domain}
                onClick={() => {
                  setSelectedDomain(item.domain);
                  setPreview(item);
                }}
                className={`px-3 py-2 rounded border text-sm transition-colors ${
                  selectedDomain === item.domain
                    ? "bg-blue-600 text-white border-blue-700"
                    : "bg-white text-blue-700 border-blue-200 hover:bg-blue-100"
                }`}
              >
                {item.domain}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Extracted data preview + accept/reject */}
      {preview && (
        <div className="mt-4 border rounded-lg">
          <div className="px-4 py-2 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              <span className="font-semibold">Extracted Preview:</span> {preview.domain}
              {decision[preview.domain] && (
                <span className={`ml-2 text-xs px-2 py-1 rounded ${decision[preview.domain] === "accepted" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {decision[preview.domain] === "accepted" ? "Accepted" : "Rejected"}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => acceptPreview(true)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm">Accept</button>
              <button onClick={() => acceptPreview(false)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm">Reject</button>
            </div>
          </div>
          <div className="p-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Information */}
              <div>
                <div className="font-semibold text-gray-800 mb-2">Contact Information</div>
                {preview.data?.contact_information ? (
                  <div className="space-y-1 text-gray-700">
                    {Object.entries(preview.data.contact_information).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3"><span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span><span className="font-medium break-all">{String(v || "")}</span></div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">No contact data</div>
                )}
              </div>

              {/* Social Media */}
              <div>
                <div className="font-semibold text-gray-800 mb-2">Social Media</div>
                {preview.data?.social_media ? (
                  <div className="space-y-1 text-gray-700">
                    {Object.entries(preview.data.social_media).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3"><span className="text-gray-500 capitalize">{k}</span><span className="font-medium break-all">{String(v || "")}</span></div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">No social links</div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Description & Industry */}
              <div>
                <div className="font-semibold text-gray-800 mb-2">Description & Industry</div>
                {preview.data?.description_industry ? (
                  <div className="space-y-1 text-gray-700">
                    {Object.entries(preview.data.description_industry).map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3"><span className="text-gray-500 capitalize">{k.replace(/_/g, " ")}</span><span className="font-medium break-all">{String(v || "")}</span></div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">No description</div>
                )}
              </div>

              {/* Services & Certifications */}
              <div>
                <div className="font-semibold text-gray-800 mb-2">Services & Certifications</div>
                <div className="space-y-2">
                  <div>
                    <div className="text-gray-600">Services</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(preview.data?.services || []).map((s: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-600">Certifications</div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {(preview.data?.certifications || []).map((c: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs">{c}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* People */}
            <div className="mt-4">
              <div className="font-semibold text-gray-800 mb-2">People</div>
              {(preview.data?.people_information || []).length > 0 ? (
                <div className="space-y-1">
                  {preview.data.people_information.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-3 text-gray-700">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-gray-600">{p.title}</span>
                      <span className="break-all text-blue-700">{p.url}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500">No people listed</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary stats */}
      <div className="mt-4 grid grid-cols-4 gap-3 text-center">
        <div className="bg-green-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Completed</div>
          <div className="text-xl font-bold text-green-600">{queueCounts.approved}</div>
        </div>
        <div className="bg-red-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Failed</div>
          <div className="text-xl font-bold text-red-600">
            {logs.filter((l) => l.level === "error").length}
          </div>
        </div>
        <div className="bg-yellow-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Warnings</div>
          <div className="text-xl font-bold text-yellow-600">
            {logs.filter((l) => l.level === "warning").length}
          </div>
        </div>
        <div className="bg-blue-50 p-3 rounded-lg">
          <div className="text-sm text-gray-600">Total Events</div>
          <div className="text-xl font-bold text-blue-600">{logs.length}</div>
        </div>
      </div>
    </div>
  );
}
