"use client";

import { useState } from "react";

interface DomainInputProps {
  onProcessingStart: (jobId: string) => void;
  apiOnline?: boolean;
}

export default function DomainInput({ onProcessingStart, apiOnline = true }: DomainInputProps) {
  const [domains, setDomains] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiOnline) {
      alert("Backend is offline. Please start the API server and try again.");
      return;
    }
    setIsSubmitting(true);

    const domainList = domains
      .split("\n")
      .map((d) => d.trim())
      .filter((d) => d.length > 0);

    try {
      const res = await fetch(`${API_BASE}/api/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: domainList }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status}: ${text}`);
      }

      const data = await res.json();
      onProcessingStart(data.job_id);
      setDomains("");
    } catch (error) {
      console.error("Error starting processing:", error);
      alert("Failed to start processing");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          Enter Domains to Process
        </h2>
        <p className="text-gray-600 mb-4">
          Enter one domain per line (e.g., example.com)
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <textarea
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
          placeholder="example.com&#10;another-company.com&#10;tech-startup.io"
          className="w-full h-64 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm text-black"
          disabled={isSubmitting}
        />

        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">
            {domains.split("\n").filter((d) => d.trim()).length} domains
          </span>
          <button
            type="submit"
            disabled={isSubmitting || !domains.trim() || !apiOnline}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
          >
            {isSubmitting ? "Starting..." : "🚀 Start Processing"}
          </button>
        </div>
      </form>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">Processing Pipeline</h3>
        <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
          <li>Scrape website content</li>
          <li>Preprocess and clean text</li>
          <li>Extract data with LLM (llama3.2:3b)</li>
          <li>Save to database (7 tables)</li>
        </ol>
      </div>
    </div>
  );
}
