"use client";

import { useEffect, useState } from "react";

export default function GraphVisualization() {
  const [graphData, setGraphData] = useState<any>(null);

  useEffect(() => {
    fetch("http://localhost:8000/api/graph")
      .then((res) => res.json())
      .then((data) => setGraphData(data))
      .catch((err) => console.error("Error fetching graph:", err));
  }, []);

  if (!graphData) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-4 text-gray-800">
          LangGraph Workflow Visualization
        </h2>
        <p className="text-gray-600 mb-6">
          The agent follows a sequential pipeline with conditional routing at each stage
        </p>
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8">
        <div className="flex items-center justify-center space-x-4 overflow-x-auto">
          {graphData.nodes.map((node: any, idx: number) => (
            <div key={node.id} className="flex items-center">
              <div className="text-center">
                <div
                  className={`w-32 h-32 rounded-lg shadow-lg flex flex-col items-center justify-center ${
                    node.type === "process"
                      ? "bg-blue-600"
                      : node.type === "llm"
                      ? "bg-purple-600"
                      : "bg-green-600"
                  } text-white`}
                >
                  <div className="text-3xl mb-2">
                    {node.type === "process"
                      ? "⚙️"
                      : node.type === "llm"
                      ? "🤖"
                      : "💾"}
                  </div>
                  <div className="text-sm font-semibold text-center px-2">
                    {node.label}
                  </div>
                </div>
                <div className="text-xs text-gray-600 mt-2">{node.id}</div>
              </div>

              {idx < graphData.nodes.length - 1 && (
                <div className="mx-4">
                  <svg width="40" height="40" className="text-gray-400">
                    <line
                      x1="0"
                      y1="20"
                      x2="40"
                      y2="20"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                    <polygon
                      points="35,15 40,20 35,25"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Node Descriptions
          </h3>
          <div className="space-y-3">
            {graphData.nodes.map((node: any) => (
              <div key={node.id} className="flex items-start">
                <div className="flex-shrink-0 w-3 h-3 rounded-full bg-blue-500 mt-1 mr-3"></div>
                <div>
                  <div className="font-medium text-gray-800">{node.label}</div>
                  <div className="text-sm text-gray-600">
                    {node.id === "scrape" &&
                      "HTTP request + BeautifulSoup parsing"}
                    {node.id === "preprocess" && "Text cleaning & normalization"}
                    {node.id === "extract" &&
                      "Ollama llama3.2:3b with structured JSON"}
                    {node.id === "save" && "SQLite storage (7 tables)"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">
            Conditional Routing
          </h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 bg-green-50 border border-green-200 rounded">
              <div className="font-medium text-green-800">✓ Success Path</div>
              <div className="text-green-700">
                Each node proceeds to next on successful completion
              </div>
            </div>
            <div className="p-3 bg-red-50 border border-red-200 rounded">
              <div className="font-medium text-red-800">✗ Failure Path</div>
              <div className="text-red-700">
                Any failure routes directly to END, saving resources
              </div>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
              <div className="font-medium text-blue-800">ℹ️ State Management</div>
              <div className="text-blue-700">
                Typed state passed between nodes with error tracking
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
