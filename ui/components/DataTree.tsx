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

interface DataTreeProps {
  companies: Company[];
}

export default function DataTree({ companies }: DataTreeProps) {
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

  // Group companies by industry
  const groupedByIndustry = companies.reduce((acc, company) => {
    const industry = company.industry || "Uncategorized";
    if (!acc[industry]) {
      acc[industry] = [];
    }
    acc[industry].push(company);
    return acc;
  }, {} as Record<string, Company[]>);

  const industries = Object.entries(groupedByIndustry).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Data Hierarchy Tree</h2>
        <p className="text-gray-600">Companies organized by industry and attributes</p>
      </div>

      <div className="font-mono text-sm space-y-1 max-h-[70vh] overflow-y-auto">
        {/* Root Node */}
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-bold">📊 Companies</span>
          <span className="text-gray-500 text-xs ml-2">({companies.length} total)</span>
        </div>

        {/* Industry Nodes */}
        {industries.map(([industry, companyList], idx) => {
          const industryId = `industry-${idx}`;
          const isIndustryExpanded = isExpanded(industryId);

          return (
            <div key={industryId}>
              {/* Industry Row */}
              <div
                className="flex items-center gap-2 ml-4 cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors"
                onClick={() => toggleNode(industryId)}
              >
                <span className="text-gray-400 w-4 text-center">
                  {isIndustryExpanded ? "▼" : "▶"}
                </span>
                <span className="text-purple-600 font-semibold">📁 {industry}</span>
                <span className="text-gray-500 text-xs ml-2">({companyList.length})</span>
              </div>

              {/* Company Nodes */}
              {isIndustryExpanded && companyList.map((company, companyIdx) => {
                const companyId = `company-${idx}-${companyIdx}`;
                const isCompanyExpanded = isExpanded(companyId);
                const hasData =
                  company.certifications.length > 0 ||
                  company.services.length > 0 ||
                  company.email ||
                  company.phone ||
                  company.address ||
                  company.linkedin;

                return (
                  <div key={companyId}>
                    {/* Company Row */}
                    <div
                      className={`flex items-center gap-2 ml-8 cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors ${
                        isCompanyExpanded ? "bg-blue-50" : ""
                      }`}
                      onClick={() => hasData && toggleNode(companyId)}
                    >
                      <span className="text-gray-400 w-4 text-center">
                        {hasData ? (isCompanyExpanded ? "▼" : "▶") : "•"}
                      </span>
                      <span className="text-blue-600 font-medium">🌐 {company.domain}</span>
                      {company.company_name && (
                        <span className="text-gray-500 text-xs">({company.company_name})</span>
                      )}
                    </div>

                    {/* Company Details */}
                    {isCompanyExpanded && (
                      <div className="ml-12 space-y-1 text-gray-700 text-xs">
                        {company.email && (
                          <div className="flex items-center gap-2 p-1 hover:bg-blue-50 rounded">
                            <span className="text-gray-400">•</span>
                            <span className="text-blue-600">📧 Email:</span>
                            <a
                              href={`mailto:${company.email}`}
                              className="text-blue-500 hover:underline"
                            >
                              {company.email}
                            </a>
                          </div>
                        )}

                        {company.phone && (
                          <div className="flex items-center gap-2 p-1 hover:bg-green-50 rounded">
                            <span className="text-gray-400">•</span>
                            <span className="text-green-600">📞 Phone:</span>
                            <a
                              href={`tel:${company.phone}`}
                              className="text-blue-500 hover:underline"
                            >
                              {company.phone}
                            </a>
                          </div>
                        )}

                        {company.address && (
                          <div className="flex items-center gap-2 p-1 hover:bg-orange-50 rounded">
                            <span className="text-gray-400">•</span>
                            <span className="text-orange-600">📍 Address:</span>
                            <span className="text-gray-700">{company.address}</span>
                          </div>
                        )}

                        {company.linkedin && (
                          <div className="flex items-center gap-2 p-1 hover:bg-indigo-50 rounded">
                            <span className="text-gray-400">•</span>
                            <span className="text-indigo-600">🔗 LinkedIn:</span>
                            <a
                              href={company.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline"
                            >
                              View Profile
                            </a>
                          </div>
                        )}

                        {company.services.length > 0 && (
                          <div className="p-1 hover:bg-blue-50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">•</span>
                              <span className="text-blue-600 font-semibold">⚙️ Services ({company.services.length}):</span>
                            </div>
                            <div className="ml-6 space-y-1">
                              {company.services.map((service, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 p-1 hover:bg-blue-100 rounded text-gray-700"
                                >
                                  <span className="text-blue-400">├</span>
                                  <span>{service}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {company.certifications.length > 0 && (
                          <div className="p-1 hover:bg-amber-50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400">•</span>
                              <span className="text-amber-600 font-semibold">🏆 Certifications ({company.certifications.length}):</span>
                            </div>
                            <div className="ml-6 space-y-1">
                              {company.certifications.map((cert, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 p-1 hover:bg-amber-100 rounded text-gray-700"
                                >
                                  <span className="text-amber-400">├</span>
                                  <span>{cert}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {company.description && (
                          <div className="p-1 hover:bg-gray-50 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-gray-400">•</span>
                              <span className="text-gray-600 font-semibold">📝 Description:</span>
                            </div>
                            <div className="ml-6 p-2 bg-gray-50 rounded border border-gray-200 text-gray-700 italic line-clamp-3">
                              {company.description}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No companies to display</p>
          <p className="text-sm">Start by processing domains in the Input tab</p>
        </div>
      )}
    </div>
  );
}
