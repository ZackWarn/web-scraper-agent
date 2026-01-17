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
    processing: "bg-blue-50 border-blue-300 animate-pulse",
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
    <div className={`border-2 rounded-lg p-4 transition-all ${statusColors[status]}`}>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-lg text-gray-900">
          {statusIcons[status]} {workerId}
        </h3>
        <span className="text-sm text-gray-800 font-semibold">{duration}</span>
      </div>

      {domain && (
        <p className="text-sm text-gray-900 mb-3 truncate" title={domain}>
          <span className="font-bold">Domain:</span> {domain}
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 mb-3 break-words">
          <span className="font-semibold">Error:</span> {error}
        </p>
      )}

      <div className="w-full bg-gray-300 rounded-full h-2">
        <div
          className={`h-2 rounded-full transition-all duration-300 ${
            status === "error"
              ? "bg-red-500"
              : status === "complete"
                ? "bg-green-500"
                : "bg-blue-500"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-xs text-gray-800 font-semibold mt-2">{progress}%</p>
    </div>
  );
}
