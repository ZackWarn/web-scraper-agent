"use client";

interface StatsCardProps {
  stats: any;
}

export default function StatsCard({ stats }: StatsCardProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-3xl font-bold text-blue-600">
          {stats.unique_companies}
        </div>
        <div className="text-sm text-gray-600">Companies</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-3xl font-bold text-green-600">
          {stats.certifications}
        </div>
        <div className="text-sm text-gray-600">Certifications</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-3xl font-bold text-purple-600">{stats.services}</div>
        <div className="text-sm text-gray-600">Services</div>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <div className="text-3xl font-bold text-orange-600">
          {stats.people_information}
        </div>
        <div className="text-sm text-gray-600">People</div>
      </div>
    </div>
  );
}
