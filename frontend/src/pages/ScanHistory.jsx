import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { scanAPI } from '../services/api';
import {
  MagnifyingGlassIcon, CheckCircleIcon,
  ExclamationTriangleIcon, ClockIcon, EyeIcon,
} from '@heroicons/react/24/outline';

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreColor = (s) => {
  if (s == null) return 'var(--text-muted)';
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#d97706';
  if (s >= 40) return '#ea580c';
  return '#dc2626';
};

const StatusIcon = ({ status }) => {
  if (status === 'completed') return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
  if (status === 'running')   return <ClockIcon className="w-5 h-5 text-yellow-500" />;
  if (status === 'failed')    return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
  return <ClockIcon className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />;
};

const StatusBadge = ({ status }) => {
  const cls = {
    completed: 'status-completed', running: 'status-running',
    failed: 'status-failed', pending: 'status-pending',
  };
  return <span className={cls[status] || 'status-pending'}>{status}</span>;
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
const HistorySkeleton = () => (
  <div className="px-4 py-6 sm:px-0 animate-pulse">
    <div className="flex justify-between items-center mb-8">
      <div>
        <div className="skeleton h-8 w-40 mb-2 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="skeleton h-10 w-28 rounded-lg" />
    </div>
    <div className="card">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="skeleton h-5 w-5 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <div className="skeleton h-4 w-3/4 mb-2 rounded" />
            <div className="skeleton h-3 w-1/3 rounded" />
          </div>
          <div className="skeleton h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const ScanHistory = () => {
  const [scans, setScans]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const location = useLocation();
  const pollRef  = useRef(null);

  useEffect(() => {
    fetchScans();
    return () => clearInterval(pollRef.current);
  }, []);

  const fetchScans = async () => {
    try {
      const res  = await scanAPI.getScans();
      const data = res.data.data || res.data.scans || [];
      setScans(data);
      const hasRunning = data.some((s) => s.status === 'running' || s.status === 'pending');
      clearInterval(pollRef.current);
      if (hasRunning) pollRef.current = setInterval(fetchScans, 4000);
    } catch {
      setError('Failed to fetch scans');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <HistorySkeleton />;

  return (
    <div className="px-4 py-6 sm:px-0">

      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="page-title">Scan History</h1>
          <p className="page-subtitle">View and manage your vulnerability scans</p>
        </div>
        <Link to="/scan" className="btn-primary">New Scan</Link>
      </div>

      {location.state?.message && (
        <div className="alert-success mb-6">{location.state.message}</div>
      )}
      {error && <div className="alert-error mb-6">{error}</div>}

      <div className="card p-0 overflow-hidden">
        {scans.length === 0 ? (
          <div className="text-center py-12 p-6">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12" style={{ color: 'var(--text-faint)' }} />
            <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              No scans found
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Get started by creating your first vulnerability scan.
            </p>
            <div className="mt-6">
              <Link to="/scan" className="btn-primary">Create First Scan</Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  {['Target URL', 'Status', 'Risk Score', 'Findings', 'Created', 'Duration', 'Actions'].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan._id} className="tr-hover">

                    {/* Target URL */}
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <StatusIcon status={scan.status} />
                        <div>
                          <div className="text-sm font-medium max-w-xs truncate"
                            style={{ color: 'var(--text-primary)' }}>
                            {scan.targetUrl}
                          </div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            ID: {scan._id.slice(-8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="td whitespace-nowrap">
                      <StatusBadge status={scan.status} />
                    </td>

                    {/* Risk Score */}
                    <td className="td whitespace-nowrap">
                      {scan.riskScore != null ? (
                        <span className="text-sm font-bold" style={{ color: scoreColor(scan.riskScore) }}>
                          {scan.riskScore}/100
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>

                    {/* Findings */}
                    <td className="td whitespace-nowrap">
                      {scan.vulnCounts?.total > 0 ? (
                        <div className="flex items-center gap-1 text-xs">
                          {scan.vulnCounts.critical > 0 && (
                            <span className="badge-critical">{scan.vulnCounts.critical}C</span>
                          )}
                          {scan.vulnCounts.high > 0 && (
                            <span className="badge-high">{scan.vulnCounts.high}H</span>
                          )}
                          {scan.vulnCounts.medium > 0 && (
                            <span className="badge-medium">{scan.vulnCounts.medium}M</span>
                          )}
                          {scan.vulnCounts.low > 0 && (
                            <span className="badge-low">{scan.vulnCounts.low}L</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }}>—</span>
                      )}
                    </td>

                    {/* Created */}
                    <td className="td whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(scan.createdAt).toLocaleDateString()}{' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {new Date(scan.createdAt).toLocaleTimeString()}
                      </span>
                    </td>

                    {/* Duration */}
                    <td className="td whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {scan.completedAt
                        ? `${Math.round((new Date(scan.completedAt) - new Date(scan.createdAt)) / 1000)}s`
                        : scan.status === 'running' ? 'In progress…' : '—'}
                    </td>

                    {/* Actions */}
                    <td className="td whitespace-nowrap text-right text-sm font-medium">
                      {scan.status === 'completed' ? (
                        <Link to={`/results/${scan._id}`}
                          className="inline-flex items-center gap-1"
                          style={{ color: 'var(--accent)' }}>
                          <EyeIcon className="w-4 h-4" /> View
                        </Link>
                      ) : scan.status === 'running' ? (
                        <span className="text-yellow-500 text-xs">Scanning…</span>
                      ) : scan.status === 'failed' ? (
                        <span className="text-red-500 text-xs">Failed</span>
                      ) : (
                        <span style={{ color: 'var(--text-faint)' }} className="text-xs">Pending</span>
                      )}
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

export default ScanHistory;
