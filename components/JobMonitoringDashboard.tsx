/**
 * Job Monitoring Dashboard Component
 * 
 * This component provides comprehensive job monitoring and debugging capabilities:
 * 1. Real-time job status monitoring
 * 2. Job failure analysis and root cause detection
 * 3. Performance metrics and memory usage tracking
 * 4. Historical job analysis and patterns
 * 5. Storage statistics and health monitoring
 */

import React, { useState, useEffect } from 'react';

interface JobAnalysis {
  jobId: string;
  summary: {
    status: string;
    duration: number;
    progress: number;
    errorCount: number;
    warningCount: number;
  };
  performance: {
    averageMemoryUsage: number;
    peakMemoryUsage: number;
    memoryGrowth: number;
    stepTimings: Record<string, number>;
  };
  issues: {
    warnings: Array<{
      type: string;
      message: string;
      timestamp: string;
    }>;
    errors: Array<{
      timestamp: string;
      message: string;
    }>;
    patterns: string[];
  };
  recommendations: string[];
  debugLogs: Array<{
    timestamp: string;
    message: string;
    level: string;
  }>;
}

interface StorageStats {
  memoryJobs: number;
  storageDir: string;
  externalStorageEnabled: boolean;
  totalJobs: number;
}

const JobMonitoringDashboard: React.FC = () => {
  const [analyses, setAnalyses] = useState<JobAnalysis[]>([]);
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [currentJobs, setCurrentJobs] = useState<any[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lookupJobId, setLookupJobId] = useState('');
  const [lookupResult, setLookupResult] = useState<any | null>(null);

  // Fetch job analyses
  const fetchJobAnalyses = async () => {
    try {
      const response = await fetch('https://database-dorkinians-4bac3364a645.herokuapp.com/api/debug/jobs');
      if (response.ok) {
        const data = await response.json();
        setAnalyses(data.analyses || []);
      } else {
        throw new Error('Failed to fetch job analyses');
      }
    } catch (err) {
      console.error('Error fetching job analyses:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Fetch storage statistics
  const fetchStorageStats = async () => {
    try {
      const response = await fetch('https://database-dorkinians-4bac3364a645.herokuapp.com/api/storage/stats');
      if (response.ok) {
        const data = await response.json();
        setStorageStats(data.stats);
      } else {
        throw new Error('Failed to fetch storage stats');
      }
    } catch (err) {
      console.error('Error fetching storage stats:', err);
    }
  };

  // Fetch current jobs
  const fetchCurrentJobs = async () => {
    try {
      const response = await fetch('https://database-dorkinians-4bac3364a645.herokuapp.com/jobs');
      if (response.ok) {
        const data = await response.json();
        setCurrentJobs(data.jobs || []);
      } else {
        throw new Error('Failed to fetch current jobs');
      }
    } catch (err) {
      console.error('Error fetching current jobs:', err);
    }
  };

  // Fetch detailed job analysis
  const fetchJobAnalysis = async (jobId: string) => {
    try {
      const response = await fetch(`https://database-dorkinians-4bac3364a645.herokuapp.com/api/debug/jobs/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setSelectedJob(data.analysis);
      } else {
        throw new Error('Failed to fetch job analysis');
      }
    } catch (err) {
      console.error('Error fetching job analysis:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  // Lookup a specific job by ID (works even if not in memory list)
  const lookupJobById = async (jobId: string) => {
    setLookupResult(null);
    setError(null);
    if (!jobId) return;
    try {
      const res = await fetch(`https://database-dorkinians-4bac3364a645.herokuapp.com/status/${encodeURIComponent(jobId)}`);
      if (res.ok) {
        const data = await res.json();
        setLookupResult({ jobId, ...data });
      } else {
        const text = await res.text();
        setLookupResult({ jobId, error: `HTTP ${res.status}: ${text}` });
      }
    } catch (e: any) {
      setLookupResult({ jobId, error: e?.message || 'Network error' });
    }
  };

  // Auto-refresh data
  useEffect(() => {
    const refreshData = () => {
      fetchJobAnalyses();
      fetchStorageStats();
      fetchCurrentJobs();
    };

    refreshData();
    setLoading(false);

    if (autoRefresh) {
      const interval = setInterval(refreshData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Format duration
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  // Format memory usage
  const formatMemory = (mb: number) => {
    return `${mb}MB`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'running': return 'text-blue-600';
      case 'lost': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  // Get warning type color
  const getWarningTypeColor = (type: string) => {
    switch (type) {
      case 'stuck_job': return 'text-yellow-600';
      case 'memory_leak': return 'text-red-600';
      case 'high_memory': return 'text-orange-600';
      case 'slow_step': return 'text-purple-600';
      case 'repeated_error': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading job monitoring data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Job Monitoring Dashboard</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-2"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => {
              fetchJobAnalyses();
              fetchStorageStats();
              fetchCurrentJobs();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Storage Statistics */}
      {storageStats && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Storage Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{storageStats.memoryJobs}</div>
              <div className="text-sm text-blue-800">Jobs in Memory</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{storageStats.totalJobs}</div>
              <div className="text-sm text-green-800">Total Jobs</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {storageStats.externalStorageEnabled ? 'Yes' : 'No'}
              </div>
              <div className="text-sm text-purple-800">External Storage</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm font-mono text-gray-600 truncate">{storageStats.storageDir}</div>
              <div className="text-sm text-gray-800">Storage Directory</div>
            </div>
          </div>
        </div>
      )}

      {/* Current Jobs */}
      {currentJobs.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-3 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Current Jobs ({currentJobs.length})</h3>
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full max-w-6xl divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Job ID
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    Progress
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    Current Step
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Started
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    Last Update
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentJobs.map((job) => (
                  <tr key={job.jobId} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs font-mono text-gray-900 truncate" title={job.jobId}>
                      {job.jobId}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900">
                      <div className="flex items-center">
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mr-1">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${job.progress || 0}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500 min-w-0">{job.progress || 0}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900 truncate" title={job.currentStep || 'N/A'}>
                      {job.currentStep || 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900 truncate" title={job.startTime ? new Date(job.startTime).toLocaleString() : 'N/A'}>
                      {job.startTime ? new Date(job.startTime).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-900 truncate" title={job.lastUpdate ? new Date(job.lastUpdate).toLocaleString() : 'N/A'}>
                      {job.lastUpdate ? new Date(job.lastUpdate).toLocaleTimeString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden">
            {currentJobs.map((job) => (
              <div key={job.jobId} className="p-4 border-b border-gray-200 last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-gray-900 truncate flex-1 mr-2" title={job.jobId}>
                    {job.jobId}
                  </span>
                  <span className={`text-xs font-medium px-2 py-1 rounded ${getStatusColor(job.status)}`}>
                    {job.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-16">Progress:</span>
                    <div className="flex-1 flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mr-2">
                        <div 
                          className="bg-blue-600 h-1.5 rounded-full" 
                          style={{ width: `${job.progress || 0}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-500">{job.progress || 0}%</span>
                    </div>
                  </div>
                  <div className="flex items-start">
                    <span className="text-xs text-gray-500 w-16">Step:</span>
                    <span className="text-xs text-gray-900 flex-1 truncate" title={job.currentStep || 'N/A'}>
                      {job.currentStep || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-16">Started:</span>
                    <span className="text-xs text-gray-900 flex-1 truncate" title={job.startTime ? new Date(job.startTime).toLocaleString() : 'N/A'}>
                      {job.startTime ? new Date(job.startTime).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-xs text-gray-500 w-16">Updated:</span>
                    <span className="text-xs text-gray-900 flex-1 truncate" title={job.lastUpdate ? new Date(job.lastUpdate).toLocaleString() : 'N/A'}>
                      {job.lastUpdate ? new Date(job.lastUpdate).toLocaleTimeString() : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Job Lookup / Diagnostics */}
      <div className="bg-white shadow rounded-lg mb-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Lookup Job by ID</h3>
          <p className="text-xs text-gray-500 mt-1">Use this to fetch a job even if it's not shown in Current Jobs.</p>
        </div>
        <div className="p-4 flex flex-col md:flex-row gap-2 items-start md:items-center">
          <input
            className="w-full md:w-96 border border-gray-300 rounded px-3 py-2 text-sm"
            placeholder="Enter job ID (e.g. seed_123456789_abcdef)"
            value={lookupJobId}
            onChange={(e) => setLookupJobId(e.target.value)}
          />
          <button
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50"
            onClick={() => lookupJobById(lookupJobId)}
            disabled={!lookupJobId}
          >
            Fetch Job Status
          </button>
        </div>
        {lookupResult && (
          <div className="px-6 pb-4 text-sm">
            {lookupResult.error ? (
              <div className="text-red-600">❌ {lookupResult.error}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div><span className="text-gray-500">Job ID:</span> <span className="font-mono">{lookupResult.jobId}</span></div>
                <div><span className="text-gray-500">Status:</span> {lookupResult.status || 'unknown'}</div>
                <div><span className="text-gray-500">Progress:</span> {typeof lookupResult.progress === 'number' ? `${lookupResult.progress}%` : 'n/a'}</div>
                <div className="md:col-span-3"><span className="text-gray-500">Current Step:</span> {lookupResult.currentStep || 'n/a'}</div>
                <div><span className="text-gray-500">Started:</span> {lookupResult.startTime ? new Date(lookupResult.startTime).toLocaleString() : 'n/a'}</div>
                <div><span className="text-gray-500">Last Update:</span> {lookupResult.lastUpdate ? new Date(lookupResult.lastUpdate).toLocaleString() : 'n/a'}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Job Analyses List */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Job Analyses ({analyses.length})</h3>
        </div>
        {analyses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issues
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyses.map((analysis) => (
                  <tr key={analysis.jobId} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {analysis.jobId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getStatusColor(analysis.summary.status)}`}>
                        {analysis.summary.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDuration(analysis.summary.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {analysis.summary.progress}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex space-x-2">
                        {analysis.summary.errorCount > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {analysis.summary.errorCount} errors
                          </span>
                        )}
                        {analysis.summary.warningCount > 0 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            {analysis.summary.warningCount} warnings
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => fetchJobAnalysis(analysis.jobId)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Job Analyses Yet</h3>
            <p className="text-gray-500 mb-4">
              Job analyses are created when jobs complete or fail. Start a seeding job to see detailed analysis.
            </p>
            <div className="text-sm text-gray-400">
              <p>• Job analyses provide detailed performance metrics</p>
              <p>• Memory usage tracking and leak detection</p>
              <p>• Error pattern analysis and recommendations</p>
              <p>• Step-by-step execution timeline</p>
            </div>
          </div>
        )}
      </div>

      {/* Selected Job Details */}
      {selectedJob && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900">
                Job Analysis: {selectedJob.jobId}
              </h3>
              <button
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Summary */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Summary</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Status</div>
                  <div className={`text-lg font-medium ${getStatusColor(selectedJob.summary.status)}`}>
                    {selectedJob.summary.status}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Duration</div>
                  <div className="text-lg font-medium text-gray-900">
                    {formatDuration(selectedJob.summary.duration)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Progress</div>
                  <div className="text-lg font-medium text-gray-900">
                    {selectedJob.summary.progress}%
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-600">Issues</div>
                  <div className="text-lg font-medium text-gray-900">
                    {selectedJob.summary.errorCount + selectedJob.summary.warningCount}
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Performance Metrics</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-3 rounded">
                  <div className="text-sm text-blue-600">Average Memory</div>
                  <div className="text-lg font-medium text-blue-900">
                    {formatMemory(selectedJob.performance.averageMemoryUsage)}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded">
                  <div className="text-sm text-red-600">Peak Memory</div>
                  <div className="text-lg font-medium text-red-900">
                    {formatMemory(selectedJob.performance.peakMemoryUsage)}
                  </div>
                </div>
                <div className="bg-yellow-50 p-3 rounded">
                  <div className="text-sm text-yellow-600">Memory Growth</div>
                  <div className="text-lg font-medium text-yellow-900">
                    {formatMemory(selectedJob.performance.memoryGrowth)}
                  </div>
                </div>
              </div>
            </div>

            {/* Issues */}
            {selectedJob.issues.warnings.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Warnings</h4>
                <div className="space-y-2">
                  {selectedJob.issues.warnings.map((warning, index) => (
                    <div key={index} className="bg-yellow-50 border border-yellow-200 rounded p-3">
                      <div className="flex items-center">
                        <span className={`text-sm font-medium ${getWarningTypeColor(warning.type)}`}>
                          {warning.type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="ml-2 text-sm text-gray-600">
                          {new Date(warning.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-700">{warning.message}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {selectedJob.recommendations.length > 0 && (
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {selectedJob.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start">
                      <svg className="h-5 w-5 text-green-500 mt-0.5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm text-gray-700">{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Debug Logs */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-3">Debug Logs (Last 20)</h4>
              <div className="bg-gray-50 rounded p-4 max-h-64 overflow-y-auto">
                <div className="space-y-1">
                  {selectedJob.debugLogs.slice(-20).map((log, index) => (
                    <div key={index} className="text-sm font-mono">
                      <span className="text-gray-500">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`ml-2 ${
                        log.level === 'error' ? 'text-red-600' :
                        log.level === 'warn' ? 'text-yellow-600' :
                        'text-gray-700'
                      }`}>
                        [{log.level.toUpperCase()}]
                      </span>
                      <span className="ml-2 text-gray-700">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JobMonitoringDashboard;
