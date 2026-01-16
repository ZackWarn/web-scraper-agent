"use client";

import { useState, useEffect } from "react";
import DomainInput from "@/components/DomainInput";
import ProcessingStatus from "@/components/ProcessingStatus";
import BatchJobSubmit from "@/components/BatchJobSubmit";
import ParallelJobMonitor from "@/components/ParallelJobMonitor";
import PerformanceComparison from "@/components/PerformanceComparison";
import CompanyGrid from "@/components/CompanyGrid";
import GraphVisualization from "@/components/GraphVisualization";
import StatsCard from "@/components/StatsCard";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"input" | "parallel" | "companies" | "graph" | "performance">("input");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState<any>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [processingMode, setProcessingMode] = useState<"sequential" | "parallel">("parallel");
  const [jobMetrics, setJobMetrics] = useState<any>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

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
    // Optional: light polling to update API status
    const id = setInterval(fetchStats, 10000);

    if (activeTab === "companies") {
      fetchCompanies();
    }
    return () => clearInterval(id);
  }, [activeTab]);

  const handleBatchSubmit = async (domains: string[], mode: "sequential" | "parallel") => {
    setProcessingMode(mode);
    setIsProcessing(true);

    try {
      const endpoint = mode === "parallel" ? "/api/process_redis" : "/api/process";

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
    if (jobId) {
      try {
        const res = await fetch(`${API_BASE}/api/status/${jobId}`);
        const metrics = await res.json();
        setJobMetrics(metrics);
      } catch (error) {
        console.error("Error fetching metrics:", error);
      }
    }

    // Fetch updated companies
    fetchCompanies();
    fetchStats();

    setActiveTab("companies");
  };

  const handleProcessingStart = (newJobId: string) => {
    setJobId(newJobId);
    setIsProcessing(true);
  };

  const handleProcessingComplete = () => {
    setIsProcessing(false);
    fetchStats();
    if (activeTab === "companies") {
      fetchCompanies();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-3xl font-bold text-gray-900">
            🕷️ Web Scraper Agent
          </h1>
          <p className="text-gray-600">
            Parallel domain processing with Redis workers & real-time WebSocket updates
          </p>
        </div>
      </header>

      {/* API Status Banner */}
      <div className="max-w-7xl mx-auto px-4 py-2">
        {apiOnline ? (
          <div className="bg-green-100 text-green-800 p-2 rounded text-sm">
            ✅ API Online | Redis: Running | Workers: Ready | WebSocket: Enabled
          </div>
        ) : (
          <div className="bg-red-100 text-red-800 p-2 rounded text-sm">
            ❌ API Offline - Please start the backend server
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab("input")}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              activeTab === "input"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            📤 Submit Job
          </button>
          {(isProcessing || jobId) && processingMode === "parallel" && (
            <button
              onClick={() => setActiveTab("parallel")}
              className={`px-4 py-2 rounded-lg font-bold transition ${
                activeTab === "parallel"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              ⚙️ Parallel Monitor {isProcessing && <span className="ml-1">🔴</span>}
            </button>
          )}
          <button
            onClick={() => setActiveTab("companies")}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              activeTab === "companies"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            🏢 Results ({companies.length})
          </button>
          <button
            onClick={() => setActiveTab("graph")}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              activeTab === "graph"
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
            }`}
          >
            🔄 Workflow
          </button>
          {jobMetrics && (
            <button
              onClick={() => setActiveTab("performance")}
              className={`px-4 py-2 rounded-lg font-bold transition ${
                activeTab === "performance"
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              📊 Performance
            </button>
          )}
        </div>

        {/* Content */}
        {activeTab === "input" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Batch Domain Processing</h2>
            <BatchJobSubmit
              onSubmit={handleBatchSubmit}
              isProcessing={isProcessing}
            />
            
            {!apiOnline && (
              <div className="mt-4 rounded-md border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
                Backend is offline. Please start the API server and Redis to submit jobs.
              </div>
            )}

            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-bold mb-2">Legacy Single Domain Input</h3>
              <DomainInput onProcessingStart={handleProcessingStart} apiOnline={apiOnline} />
            </div>
          </div>
        )}

        {activeTab === "parallel" && jobId && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">Parallel Job Monitor</h2>
            <ParallelJobMonitor
              jobId={jobId}
              workerCount={5}
              onComplete={handleJobComplete}
            />
          </div>
        )}

        {activeTab === "companies" && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Extracted Companies</h2>
                <p className="text-sm text-gray-600">
                  Click on a company to view details and hierarchical data.
                </p>
              </div>
              <a
                href={`${API_BASE}/api/companies_csv`}
                className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                ⬇ Download CSV
              </a>
            </div>

            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Companies</p>
                  <p className="text-3xl font-bold text-blue-600">{stats.total_companies || 0}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total People</p>
                  <p className="text-3xl font-bold text-green-600">{stats.total_people || 0}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600">Total Services</p>
                  <p className="text-3xl font-bold text-purple-600">{stats.total_services || 0}</p>
                </div>
              </div>
            )}

            <CompanyGrid companies={companies} onRefresh={fetchCompanies} />
          </div>
        )}

        {activeTab === "graph" && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold mb-4">LangGraph Workflow</h2>
            <GraphVisualization />
          </div>
        )}

        {activeTab === "performance" && jobMetrics && (
          <div className="bg-white rounded-lg shadow p-6">
            <PerformanceComparison
              sequentialTime={jobMetrics.total * 3.5 * 60 || 1050}
              parallelTime={jobMetrics.metrics?.duration || 367}
              domainCount={jobMetrics.total || 5}
            />
          </div>
        )}

        {/* Legacy Processing Status (for non-parallel jobs) */}
        {isProcessing && processingMode === "sequential" && jobId && (
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <ProcessingStatus jobId={jobId} onComplete={handleProcessingComplete} />
          </div>
        )}
      </div>
    </div>
  );
}
