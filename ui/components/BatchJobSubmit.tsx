"use client";

import { useState } from "react";

interface BatchJobSubmitProps {
  onSubmit: (domains: string[], processingMode: "sequential" | "parallel") => void;
  isProcessing: boolean;
}

export default function BatchJobSubmit({
  onSubmit,
  isProcessing,
}: BatchJobSubmitProps) {
  const [domainText, setDomainText] = useState("");
  const [processingMode, setProcessingMode] = useState<"sequential" | "parallel">("parallel");
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
    setDomainText(""); // Clear after submit
  };

  const domainCount = domainText
    .split(/[\n,]/)
    .filter((d) => d.trim().length > 0 && d.includes(".")).length;

  const estimatedSequential = Math.ceil((domainCount * 3.5) / 60);
  const estimatedParallel = Math.ceil((domainCount * 3.5) / (workerCount * 60));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-bold mb-2 text-gray-900">
          Domains (one per line or comma-separated):
        </label>
        <textarea
          value={domainText}
          onChange={(e) => setDomainText(e.target.value)}
          placeholder="example.com&#10;google.com&#10;github.com"
          className="w-full h-32 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          disabled={isProcessing}
        />
        <p className="text-xs text-gray-800 mt-1">
          {domainCount > 0 ? (
            <>
              <span className="font-bold text-green-600">{domainCount}</span> valid domains detected
            </>
          ) : (
            "Enter domains to see count"
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-bold mb-2 text-gray-900">Processing Mode:</label>
          <select
            value={processingMode}
            onChange={(e) => setProcessingMode(e.target.value as "sequential" | "parallel")}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
            disabled={isProcessing}
          >
            <option value="sequential">Sequential (1 worker)</option>
            <option value="parallel">Parallel (Multiple workers)</option>
          </select>
        </div>

        {processingMode === "parallel" && (
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-900">Worker Count:</label>
            <select
              value={workerCount}
              onChange={(e) => setWorkerCount(Number(e.target.value))}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-semibold"
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

      {domainCount > 0 && (
        <div className={`border rounded-lg p-3 ${
          processingMode === "parallel" ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"
        }`}>
          <p className="text-sm font-bold mb-1">
            {processingMode === "parallel" ? "⚡ Parallel Processing" : "⏱️ Sequential Processing"}
          </p>
          <p className="text-sm text-gray-900">
            {processingMode === "parallel" ? (
              <>
                <strong>Estimated time:</strong> ~{estimatedParallel} {estimatedParallel === 1 ? "minute" : "minutes"} with {workerCount} workers
                <br />
                <span className="text-green-600">
                  (vs ~{estimatedSequential} {estimatedSequential === 1 ? "minute" : "minutes"} sequential = {((1 - estimatedParallel / estimatedSequential) * 100).toFixed(0)}% faster)
                </span>
              </>
            ) : (
              <>
                <strong>Estimated time:</strong> ~{estimatedSequential} {estimatedSequential === 1 ? "minute" : "minutes"}
              </>
            )}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isProcessing || domainCount === 0}
        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
      >
        {isProcessing ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Processing...
          </span>
        ) : (
          `Submit ${domainCount} ${domainCount === 1 ? "Domain" : "Domains"}`
        )}
      </button>
    </form>
  );
}
