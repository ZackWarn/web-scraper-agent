"use client";

import { useState } from "react";

interface Company {
  domain: string;
  company_name: string | null;
  industry: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  linkedin: string | null;
  certifications: string[];
  services: string[];
}

interface CompanyDetailProps {
  company: Company;
  onClose: () => void;
}

export default function CompanyDetail({ company, onClose }: CompanyDetailProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "tree">("overview");
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    const newSet = new Set(expandedNodes);
    if (newSet.has(nodeId)) {
      newSet.delete(nodeId);
    } else {
      newSet.add(nodeId);
    }
    setExpandedNodes(newSet);
  };

  const isExpanded = (nodeId: string) => expandedNodes.has(nodeId);

  // Data for visualization
  const dataMetrics = {
    email: company.email ? 1 : 0,
    phone: company.phone ? 1 : 0,
    address: company.address ? 1 : 0,
    linkedin: company.linkedin ? 1 : 0,
    certifications: company.certifications.length,
    services: company.services.length,
  };

  const totalDataPoints = Object.values(dataMetrics).reduce((a, b) => a + b, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-2xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 flex items-center justify-between border-b">
          <div className="flex-1">
            <h2 className="text-3xl font-bold mb-2">{company.company_name || company.domain}</h2>
            <div className="flex items-center gap-4 text-blue-100">
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white underline"
              >
                {company.domain} ↗
              </a>
              {company.industry && (
                <span className="inline-block px-3 py-1 bg-blue-500 rounded-full text-sm">
                  {company.industry}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {(["overview", "details", "tree"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 px-4 font-medium transition-colors ${
                activeTab === tab
                  ? "text-blue-600 border-b-2 border-blue-600 bg-white"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {tab === "tree" ? "🌳 Tree" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {company.description && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Description</h3>
                  <p className="text-gray-700 leading-relaxed">{company.description}</p>
                </div>
              )}

              {/* Contact Information Grid */}
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {company.email && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <p className="text-sm text-gray-600 font-medium mb-1">Email</p>
                      <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline break-all">
                        {company.email}
                      </a>
                    </div>
                  )}
                  {company.phone && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <p className="text-sm text-gray-600 font-medium mb-1">Phone</p>
                      <a href={`tel:${company.phone}`} className="text-green-600 hover:underline">
                        {company.phone}
                      </a>
                    </div>
                  )}
                  {company.address && (
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200 md:col-span-2">
                      <p className="text-sm text-gray-600 font-medium mb-1">Address</p>
                      <p className="text-orange-700">{company.address}</p>
                    </div>
                  )}
                  {company.linkedin && (
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                      <p className="text-sm text-gray-600 font-medium mb-1">LinkedIn</p>
                      <a
                        href={company.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:underline break-all"
                      >
                        View Profile ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Services */}
              {company.services.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Services ({company.services.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.services.map((service, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors"
                      >
                        {service}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Certifications */}
              {company.certifications.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Certifications ({company.certifications.length})</h3>
                  <div className="flex flex-wrap gap-2">
                    {company.certifications.map((cert, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-2 bg-amber-100 text-amber-800 rounded-full text-sm font-medium hover:bg-amber-200 transition-colors"
                      >
                        🏆 {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {company.services.length === 0 && company.certifications.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No services or certifications found.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "tree" && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Data Structure</h3>
              
              <div className="font-mono text-sm space-y-1 bg-gray-50 p-4 rounded border border-gray-200 overflow-x-auto max-h-[50vh] overflow-y-auto">
                {/* Root Node */}
                <div className="flex items-center gap-2">
                  <span className="text-blue-600 font-bold">🌐 {company.domain}</span>
                </div>

                {/* Company Name */}
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-700 font-semibold">📝 Company:</span>
                  <span className="text-gray-600">{company.company_name || "Not extracted"}</span>
                </div>

                {/* Industry */}
                <div className="flex items-center gap-2 ml-4">
                  <span className="text-gray-400">•</span>
                  <span className="text-purple-600 font-semibold">🏢 Industry:</span>
                  <span className="text-gray-600">{company.industry || "Not extracted"}</span>
                </div>

                {/* Description */}
                {company.description && (
                  <div className="ml-4">
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-1 rounded" onClick={() => toggleNode("desc")}>
                      <span className="text-gray-400">{isExpanded("desc") ? "▼" : "▶"}</span>
                      <span className="text-gray-700 font-semibold">📋 Description</span>
                    </div>
                    {isExpanded("desc") && (
                      <div className="ml-6 p-2 bg-white border border-gray-200 rounded text-gray-700 text-xs italic">
                        {company.description}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Information */}
                <div className="ml-4">
                  <div className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-1 rounded" onClick={() => toggleNode("contact")}>
                    <span className="text-gray-400">{isExpanded("contact") ? "▼" : "▶"}</span>
                    <span className="text-blue-600 font-semibold">📞 Contact Information</span>
                  </div>
                  {isExpanded("contact") && (
                    <div className="ml-6 space-y-1">
                      {company.email && (
                        <div className="flex items-center gap-2 p-1 hover:bg-blue-50 rounded">
                          <span className="text-blue-400">├</span>
                          <span className="text-gray-700">📧 Email:</span>
                          <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline break-all">
                            {company.email}
                          </a>
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center gap-2 p-1 hover:bg-green-50 rounded">
                          <span className="text-green-400">├</span>
                          <span className="text-gray-700">📱 Phone:</span>
                          <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">
                            {company.phone}
                          </a>
                        </div>
                      )}
                      {company.address && (
                        <div className="flex items-center gap-2 p-1 hover:bg-orange-50 rounded">
                          <span className="text-orange-400">├</span>
                          <span className="text-gray-700">📍 Address:</span>
                          <span className="text-gray-600">{company.address}</span>
                        </div>
                      )}
                      {company.linkedin && (
                        <div className="flex items-center gap-2 p-1 hover:bg-indigo-50 rounded">
                          <span className="text-indigo-400">└</span>
                          <span className="text-gray-700">🔗 LinkedIn:</span>
                          <a href={company.linkedin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            View Profile
                          </a>
                        </div>
                      )}
                      {!company.email && !company.phone && !company.address && !company.linkedin && (
                        <div className="text-gray-500 italic">No contact information available</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Services */}
                {company.services.length > 0 && (
                  <div className="ml-4">
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-blue-100 p-1 rounded" onClick={() => toggleNode("services")}>
                      <span className="text-gray-400">{isExpanded("services") ? "▼" : "▶"}</span>
                      <span className="text-blue-600 font-semibold">⚙️ Services ({company.services.length})</span>
                    </div>
                    {isExpanded("services") && (
                      <div className="ml-6 space-y-1">
                        {company.services.map((service, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1 hover:bg-blue-50 rounded">
                            <span className="text-blue-400">{idx === company.services.length - 1 ? "└" : "├"}</span>
                            <span className="text-gray-700">{service}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Certifications */}
                {company.certifications.length > 0 && (
                  <div className="ml-4">
                    <div className="flex items-center gap-2 cursor-pointer hover:bg-amber-100 p-1 rounded" onClick={() => toggleNode("certs")}>
                      <span className="text-gray-400">{isExpanded("certs") ? "▼" : "▶"}</span>
                      <span className="text-amber-600 font-semibold">🏆 Certifications ({company.certifications.length})</span>
                    </div>
                    {isExpanded("certs") && (
                      <div className="ml-6 space-y-1">
                        {company.certifications.map((cert, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-1 hover:bg-amber-50 rounded">
                            <span className="text-amber-400">{idx === company.certifications.length - 1 ? "└" : "├"}</span>
                            <span className="text-gray-700">{cert}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
          <a
            href={`https://${company.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Visit Website ↗
          </a>
        </div>
      </div>
    </div>
  );
}
