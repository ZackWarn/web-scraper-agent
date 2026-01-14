"use client";

import { useState } from "react";
import CompanyDetail from "./CompanyDetail";

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

interface CompanyGridProps {
  companies: Company[];
  onRefresh: () => void;
}

export default function CompanyGrid({ companies, onRefresh }: CompanyGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterBy, setFilterBy] = useState<"all" | "name" | "industry" | "email">("all");
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Filter companies based on search term
  const filteredCompanies = companies.filter((company) => {
    const searchLower = searchTerm.toLowerCase();
    
    if (filterBy === "name") {
      return (company.company_name || company.domain).toLowerCase().includes(searchLower);
    }
    if (filterBy === "industry") {
      return (company.industry || "").toLowerCase().includes(searchLower);
    }
    if (filterBy === "email") {
      return (company.email || "").toLowerCase().includes(searchLower);
    }

    // Search all fields when "all" is selected
    return (
      (company.company_name || "").toLowerCase().includes(searchLower) ||
      company.domain.toLowerCase().includes(searchLower) ||
      (company.industry || "").toLowerCase().includes(searchLower) ||
      (company.email || "").toLowerCase().includes(searchLower) ||
      (company.phone || "").toLowerCase().includes(searchLower)
    );
  });

  // Calculate statistics for data visualization
  const stats = {
    total: companies.length,
    withEmail: companies.filter((c) => c.email).length,
    withPhone: companies.filter((c) => c.phone).length,
    withLinkedIn: companies.filter((c) => c.linkedin).length,
    industries: new Set(companies.filter((c) => c.industry).map((c) => c.industry)).size,
  };
  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Companies
            </label>
            <input
              type="text"
              placeholder="Search by name, domain, industry, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filter By
            </label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="all">All Fields</option>
              <option value="name">Company Name</option>
              <option value="industry">Industry</option>
              <option value="email">Email</option>
            </select>
          </div>
          <div>
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
        {searchTerm && (
          <div className="mt-3 text-sm text-gray-600">
            Showing {filteredCompanies.length} of {companies.length} companies
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredCompanies.map((company) => (
          <div
            key={company.domain}
            onClick={() => setSelectedCompany(company)}
            className="bg-gradient-to-br from-white to-gray-50 rounded-lg shadow-md hover:shadow-lg transition-all hover:scale-105 p-6 border border-gray-200 cursor-pointer"
          >
            {/* Header with company info */}
            <div className="mb-4 pb-4 border-b-2 border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-1 truncate">
                {company.company_name || company.domain}
              </h3>
              <a
                href={`https://${company.domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {company.domain} ↗
              </a>
            </div>

            {/* Industry badge */}
            {company.industry && (
              <div className="mb-4">
                <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 text-xs font-medium rounded-full">
                  {company.industry}
                </span>
              </div>
            )}

            {/* Description */}
            {company.description && (
              <p className="text-sm text-gray-600 mb-4 line-clamp-2 italic">
                {company.description}
              </p>
            )}

            {/* Contact info with visual indicators */}
            <div className="space-y-2 text-sm mb-4">
              {company.email && (
                <div className="flex items-start bg-blue-50 p-2 rounded">
                  <span className="mr-2">📧</span>
                  <span className="text-gray-700 break-all text-xs">{company.email}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex items-start bg-green-50 p-2 rounded">
                  <span className="mr-2">📞</span>
                  <span className="text-gray-700 text-xs">{company.phone}</span>
                </div>
              )}
              {company.address && (
                <div className="flex items-start bg-orange-50 p-2 rounded">
                  <span className="mr-2">📍</span>
                  <span className="text-gray-700 line-clamp-2 text-xs">{company.address}</span>
                </div>
              )}
              {company.linkedin && (
                <div className="flex items-start bg-indigo-50 p-2 rounded">
                  <span className="mr-2">🔗</span>
                  <a
                    href={company.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline break-all text-xs"
                  >
                    LinkedIn Profile
                  </a>
                </div>
              )}
            </div>

            {/* Certifications */}
            {company.certifications.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  CERTIFICATIONS ({company.certifications.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {company.certifications.slice(0, 2).map((cert, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded"
                    >
                      🏆 {cert}
                    </span>
                  ))}
                  {company.certifications.length > 2 && (
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      +{company.certifications.length - 2} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Services */}
            {company.services.length > 0 && (
              <div className="mb-4 pb-4 border-b border-gray-100">
                <div className="text-xs font-semibold text-gray-500 mb-2">
                  SERVICES ({company.services.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {company.services.slice(0, 3).map((service, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded"
                    >
                      {service}
                    </span>
                  ))}
                  {company.services.length > 3 && (
                    <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                      +{company.services.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Data indicators at bottom */}
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex flex-wrap gap-2 text-xs">
                {company.email && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">📧 Email</span>}
                {company.phone && <span className="px-2 py-1 bg-green-100 text-green-700 rounded">📞 Phone</span>}
                {company.address && <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded">📍 Address</span>}
                {company.linkedin && <span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded">🔗 LinkedIn</span>}
                {company.certifications.length > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">🏆 {company.certifications.length} Cert</span>}
                {company.services.length > 0 && <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">⚙️ {company.services.length} Svc</span>}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap">Click to expand ➜</span>
            </div>
          </div>
        ))}
      </div>

      {companies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No companies processed yet.</p>
          <p className="text-sm">Start by entering domains in the Input tab.</p>
        </div>
      )}

      {companies.length > 0 && filteredCompanies.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No companies match your search.</p>
          <p className="text-sm">Try a different search term or filter.</p>
        </div>
      )}

      {selectedCompany && (
        <CompanyDetail
          company={selectedCompany}
          onClose={() => setSelectedCompany(null)}
        />
      )}
    </div>
  );
}
