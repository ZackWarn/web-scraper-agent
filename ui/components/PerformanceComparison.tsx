"use client";

interface PerformanceComparisonProps {
  sequentialTime: number; // seconds
  parallelTime: number; // seconds
  domainCount: number;
}

export default function PerformanceComparison({
  sequentialTime,
  parallelTime,
  domainCount,
}: PerformanceComparisonProps) {
  const speedup = sequentialTime / parallelTime;
  const timeSaved = sequentialTime - parallelTime;
  const percentFaster = ((timeSaved / sequentialTime) * 100).toFixed(1);

  const maxTime = Math.max(sequentialTime, parallelTime);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold">Performance Comparison</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sequential */}
        <div className="border-2 border-gray-300 rounded-lg p-6 bg-white">
          <h4 className="font-bold text-xl mb-4 flex items-center">
            <span className="text-2xl mr-2">🐌</span>
            Sequential (1 worker)
          </h4>
          <div className="space-y-3 mb-4">
            <div>
              <p className="text-sm text-gray-600">Time</p>
              <p className="text-3xl font-bold text-gray-700">{formatTime(sequentialTime)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Throughput</p>
              <p className="text-lg font-semibold text-gray-600">
                {(domainCount / (sequentialTime / 60)).toFixed(2)} domains/min
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg per domain</p>
              <p className="text-lg font-semibold text-gray-600">
                {(sequentialTime / domainCount).toFixed(1)}s
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-10 relative">
            <div
              className="bg-gray-500 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ width: "100%" }}
            >
              {formatTime(sequentialTime)}
            </div>
          </div>
        </div>

        {/* Parallel */}
        <div className="border-2 border-green-400 rounded-lg p-6 bg-gradient-to-br from-green-50 to-white">
          <h4 className="font-bold text-xl mb-4 text-green-700 flex items-center">
            <span className="text-2xl mr-2">⚡</span>
            Parallel (5 workers)
          </h4>
          <div className="space-y-3 mb-4">
            <div>
              <p className="text-sm text-gray-600">Time</p>
              <p className="text-3xl font-bold text-green-600">{formatTime(parallelTime)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Throughput</p>
              <p className="text-lg font-semibold text-green-600">
                {(domainCount / (parallelTime / 60)).toFixed(2)} domains/min
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg per domain</p>
              <p className="text-lg font-semibold text-green-600">
                {(parallelTime / domainCount).toFixed(1)}s
              </p>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-10 relative">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold transition-all duration-500"
              style={{ width: `${(parallelTime / maxTime) * 100}%` }}
            >
              {formatTime(parallelTime)}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-blue-50 via-green-50 to-yellow-50 border-2 border-green-300 rounded-lg p-6">
        <h4 className="font-bold text-lg mb-4 text-center">Performance Gains</h4>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div>
            <p className="text-gray-600 text-sm mb-1">Speedup Factor</p>
            <p className="text-5xl font-bold text-green-600">{speedup.toFixed(1)}x</p>
            <p className="text-xs text-gray-500 mt-1">times faster</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-1">Time Saved</p>
            <p className="text-5xl font-bold text-blue-600">{Math.floor(timeSaved / 60)}m</p>
            <p className="text-xs text-gray-500 mt-1">{(timeSaved % 60).toFixed(0)}s saved</p>
          </div>
          <div>
            <p className="text-gray-600 text-sm mb-1">Efficiency</p>
            <p className="text-5xl font-bold text-orange-600">{percentFaster}%</p>
            <p className="text-xs text-gray-500 mt-1">reduction</p>
          </div>
        </div>
      </div>

      {/* Visual Comparison Bar */}
      <div className="bg-white border border-gray-300 rounded-lg p-6">
        <h4 className="font-bold text-lg mb-4">Visual Time Comparison</h4>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-semibold">Sequential</span>
              <span className="text-sm text-gray-600">{formatTime(sequentialTime)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="bg-gray-500 h-6 rounded-full"
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-semibold text-green-700">Parallel</span>
              <span className="text-sm text-green-600">{formatTime(parallelTime)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-6">
              <div
                className="bg-green-500 h-6 rounded-full"
                style={{ width: `${(parallelTime / sequentialTime) * 100}%` }}
              />
            </div>
          </div>
        </div>
        <p className="text-center text-sm text-gray-600 mt-4">
          Parallel processing is <strong className="text-green-600">{speedup.toFixed(1)}x faster</strong> than sequential
        </p>
      </div>
    </div>
  );
}
