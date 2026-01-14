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

interface CompanyTableProps {
  companies: Company[];
  onRefresh: () => void;
}

export default function CompanyTable({ companies, onRefresh }: CompanyTableProps) {
  const [sortBy, setSortBy] = useState<keyof Company>("domain");
  const [searchTerm, setSearchTerm] = useState("");

  // Filter companies
  const filteredCompanies = companies.filter((company) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      company.domain.toLowerCase().includes(searchLower) ||
      (company.company_name || "").toLowerCase().includes(searchLower) ||
      (company.industry || "").toLowerCase().includes(searchLower) ||
      (company.email || "").toLowerCase().includes(searchLower)
    );
  });

  // Sort companies
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const aVal = a[sortBy] || "";
    const bVal = b[sortBy] || "";
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal);
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Companies
            </label>
            <input
              type="text"
              placeholder="Search by domain, name, industry, email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sort By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as keyof Company)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="domain">Domain</option>
              <option value="company_name">Company Name</option>
              <option value="industry">Industry</option>
              <option value="email">Email</option>
            </select>
          </div>
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-600">
          Showing {sortedCompanies.length} of {companies.length} companies
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Domain</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Company Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Industry</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Phone</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Address</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">LinkedIn</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Certs</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Services</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Description</th>
            </tr>
          </thead>
          <tbody>
            {sortedCompanies.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-gray-500">
                  No companies found
                </td>
              </tr>
            ) : (
              sortedCompanies.map((company, idx) => (
                <tr
                  key={company.domain}
                  className={`border-b border-gray-200 hover:bg-blue-50 transition-colors ${
                    idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                  }`}
                >
                  {/* Domain */}
                  <td className="px-4 py-3">
                    <a
                      href={`https://${company.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {company.domain}
                    </a>
                  </td>

                  {/* Company Name */}
                  <td className="px-4 py-3 text-gray-700">
                    {company.company_name || "-"}
                  </td>

                  {/* Industry */}
                  <td className="px-4 py-3">
                    {company.industry ? (
                      <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                        {company.industry}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3">
                    {company.email ? (
                      <a
                        href={`mailto:${company.email}`}
                        className="text-blue-600 hover:underline break-all"
                      >
                        {company.email}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Phone */}
                  <td className="px-4 py-3 text-gray-700">
                    {company.phone ? (
                      <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">
                        {company.phone}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Address */}
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                    {company.address || "-"}
                  </td>

                  {/* LinkedIn */}
                  <td className="px-4 py-3">
                    {company.linkedin ? (
                      <a
                        href={company.linkedin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        🔗 Profile
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Certifications Count */}
                  <td className="px-4 py-3 text-center">
                    {company.certifications.length > 0 ? (
                      <span className="inline-block px-2 py-1 bg-amber-100 text-amber-800 rounded text-xs font-semibold">
                        {company.certifications.length}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Services Count */}
                  <td className="px-4 py-3 text-center">
                    {company.services.length > 0 ? (
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        {company.services.length}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* Description */}
                  <td className="px-4 py-3 text-gray-700 max-w-xs truncate">
                    {company.description || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Details Export */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          ℹ️ Showing {sortedCompanies.length} companies with all extracted data. Download CSV above for full details.
        </p>
      </div>
    </div>
  );
}
