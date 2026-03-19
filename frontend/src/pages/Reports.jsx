import { useState, useEffect } from 'react';
import { reportAPI } from '../services/api';
import {
  DocumentTextIcon,
  ArrowDownTrayIcon,
  CalendarIcon,
  ShieldExclamationIcon
} from '@heroicons/react/24/outline';

const getRiskColor = (score) => {
  if (score == null) return 'text-dark-400';
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
};

const getRiskLabel = (score) => {
  if (score == null) return 'N/A';
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Medium Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
};

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState({});

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await reportAPI.getReports();
      setReports(response.data.data || response.data.reports || []);
    } catch {
      setError('Failed to fetch reports');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (scanId, filename) => {
    setDownloading((prev) => ({ ...prev, [scanId]: true }));
    try {
      const response = await reportAPI.downloadReport(scanId);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `threatlens-report-${scanId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading((prev) => ({ ...prev, [scanId]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-dark-50">Reports</h1>
        <p className="mt-1 text-dark-400">Download PDF vulnerability assessment reports</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="card">
        {reports.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-dark-600" />
            <h3 className="mt-2 text-sm font-medium text-dark-300">No reports available</h3>
            <p className="mt-1 text-sm text-dark-500">
              Reports are generated automatically after scans complete.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-700">
              <thead className="bg-dark-700">
                <tr>
                  {['Report', 'Target URL', 'Risk Score', 'Findings', 'Generated', 'Size', 'Actions'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {reports.map((report) => (
                  <tr key={report._id} className="hover:bg-dark-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <DocumentTextIcon className="w-5 h-5 text-red-500 mr-3 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-medium text-dark-100">
                            {report.filename || `Report ${String(report._id).slice(-8)}`}
                          </div>
                          <div className="text-xs text-dark-400">PDF Document</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-dark-100 max-w-xs truncate">{report.targetUrl || report.url}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-bold ${getRiskColor(report.riskScore)}`}>
                        {report.riskScore != null ? `${report.riskScore}/100` : '—'}
                      </div>
                      <div className={`text-xs ${getRiskColor(report.riskScore)}`}>
                        {getRiskLabel(report.riskScore)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-dark-300">
                        <ShieldExclamationIcon className="w-4 h-4 mr-1 text-orange-400" />
                        {report.findingsCount ?? '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-dark-300">
                        <CalendarIcon className="w-4 h-4 mr-2 flex-shrink-0" />
                        <div>
                          <div>{new Date(report.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-dark-500">{new Date(report.createdAt).toLocaleTimeString()}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-dark-300">
                      {report.size || '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDownload(report.scanId || report._id, report.filename)}
                        disabled={downloading[report._id]}
                        className="text-primary-500 hover:text-primary-400 inline-flex items-center disabled:opacity-50"
                      >
                        {downloading[report._id] ? (
                          <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500 mr-2" />Downloading...</>
                        ) : (
                          <><ArrowDownTrayIcon className="w-4 h-4 mr-1" />Download</>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;
