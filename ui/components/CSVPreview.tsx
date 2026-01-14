"use client";

import { useEffect, useState } from "react";

interface CSVPreviewProps {
  url: string;
  title?: string;
  limitText?: string;
}

export default function CSVPreview({ url, title = "CSV Preview", limitText }: CSVPreviewProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => 
  {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      const data = await res.json();
      setHeaders(data.headers || []);
      setRows(data.rows || []);
    } catch (err: any) {
      setError("Failed to load CSV preview");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [url]);

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          {limitText && <p className="text-xs text-gray-500">{limitText}</p>}
        </div>
        <button
          onClick={load}
          className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          🔄 Refresh preview
        </button>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading...</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="text-sm text-gray-500">No data available yet.</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="overflow-auto border border-gray-100 rounded">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-3 py-2 text-left font-semibold text-gray-700">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 10).map((row, idx) => (
                <tr key={idx} className="odd:bg-white even:bg-gray-50">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 text-gray-700 align-top">
                      {cell || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 10 && (
        <div className="text-xs text-gray-500 mt-2">
          Showing first 10 rows of {rows.length}. Download for full data.
        </div>
      )}
    </div>
  );
}
