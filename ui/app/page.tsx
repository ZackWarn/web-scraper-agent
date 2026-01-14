"use client";

import { useState, useEffect } from "react";
import DomainInput from "@/components/DomainInput";
import ProcessingStatus from "@/components/ProcessingStatus";
import CompanyGrid from "@/components/CompanyGrid";
import GraphVisualization from "@/components/GraphVisualization";
import StatsCard from "@/components/StatsCard";

export default function Home() {
  const [activeTab, setActiveTab] = useState<"input" | "companies" | "graph">("input");
  const [jobId, setJobId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [stats, setStats] = useState<any>(null);
  const [apiOnline, setApiOnline] = useState<boolean>(false);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Company Intelligence Agent
          </h1>
          <p className="text-gray-600">
            LangGraph-powered web scraping with local LLM extraction
          </p>
        </div>

        {isProcessing && jobId && (
          <ProcessingStatus jobId={jobId} onComplete={handleProcessingComplete} />
        )}

        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex border-b border-gray-200 mb-6">
            <button
              onClick={() => setActiveTab("input")}
              className={`px-6 py-3 font-medium ${activeTab === "input"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Input Domains
            </button>
            <button
              onClick={() => setActiveTab("companies")}
              className={`px-6 py-3 font-medium ${activeTab === "companies"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Companies
            </button>
            <button
              onClick={() => setActiveTab("graph")}
              className={`px-6 py-3 font-medium ${activeTab === "graph"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
                }`}
            >
              Workflow Graph
            </button>
          </div>

          {activeTab === "input" && (
            <div className="space-y-6">
              {!apiOnline && (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-yellow-800">
                  Backend is offline. You can browse the UI, but actions are disabled.
                </div>
              )}
              <DomainInput onProcessingStart={handleProcessingStart} apiOnline={apiOnline} />
            </div>
          )}
          {activeTab === "companies" && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">Browse Companies</h3>
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

              <CompanyGrid companies={companies} onRefresh={fetchCompanies} />
            </div>
          )}
          {activeTab === "graph" && <GraphVisualization />}
        </div>
      </div>
    </div>
  );
}
