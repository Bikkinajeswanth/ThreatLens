import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { scanAPI } from '../services/api';
import {
  GlobeAltIcon,
  MagnifyingGlassIcon,
  EyeIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

// ── Helpers ───────────────────────────────────────────────────────────────────

const scoreColor = (s) => {
  if (s == null) return 'var(--text-muted)';
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#d97706';
  if (s >= 40) return '#ea580c';
  return '#dc2626';
};

const scoreLabel = (s) => {
  if (s == null) return '—';
  if (s >= 80) return 'Low Risk';
  if (s >= 60) return 'Medium Risk';
  if (s >= 40) return 'High Risk';
  return 'Critical Risk';
};

const StatusIcon = ({ status }) => {
  if (status === 'completed') return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
  if (status === 'running')   return <ClockIcon className="w-4 h-4 text-yellow-500" />;
  if (status === 'failed')    return <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />;
  return <ClockIcon className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />;
};

/**
 * Extract the hostname from a URL string, falling back to the raw string
 * if parsing fails (e.g. the value is already a hostname).
 */
const toHostname = (url) => {
  try { return new URL(url).hostname; } catch { return url; }
};

/**
 * Group an array of scans by hostname.
 * Returns an array of target objects, each holding the latest scan and
 * the full scan history for that host.
 */
const groupByTarget = (scans) => {
  const map = new Map();

  for (const scan of scans) {
    const host = toHostname(scan.targetUrl);
    if (!map.has(host)) {
      map.set(host, { host, scans: [] });
    }
    map.get(host).scans.push(scan);
  }

  return Array.from(map.values())
    .map(({ host, scans: hostScans }) => {
      // Sort descending by createdAt so index 0 is the most recent
      const sorted = [...hostScans].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      return {
        host,
        latest:     sorted[0],
        scanCount:  sorted.length,
        allScans:   sorted,
      };
    })
    // Sort targets by most-recently-scanned first
    .sort((a, b) => new Date(b.latest.createdAt) - new Date(a.latest.createdAt));
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

const TargetsSkeleton = () => (
  <div className="px-4 py-6 sm:px-0 animate-pulse">
    <div className="flex justify-between items-center mb-8">
      <div>
        <div className="skeleton h-8 w-32 mb-2 rounded" />
        <div className="skeleton h-4 w-64 rounded" />
      </div>
      <div className="skeleton h-10 w-28 rounded-lg" />
    </div>
    <div className="card p-0 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex gap-4 px-4 py-4"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}
        >
          <div className="skeleton h-5 w-5 rounded-full flex-shrink-0 mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-1/2 rounded" />
            <div className="skeleton h-3 w-1/4 rounded" />
          </div>
          <div className="skeleton h-6 w-16 rounded-full" />
          <div className="skeleton h-6 w-20 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// ── Expanded history row ───────────────────────────────────────────────────────

const HistoryRow = ({ scan }) => (
  <tr className="tr-hover" style={{ backgroundColor: 'var(--bg-primary)' }}>
    <td className="td pl-12">
      <div className="flex items-center gap-2">
        <StatusIcon status={scan.status} />
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {scan.targetUrl}
        </span>
      </div>
    </td>
    <td className="td whitespace-nowrap">
      <span className={`status-${scan.status}`}>{scan.status}</span>
    </td>
    <td className="td whitespace-nowrap">
      {scan.riskScore != null ? (
        <span className="text-sm font-bold" style={{ color: scoreColor(scan.riskScore) }}>
          {scan.riskScore}/100
        </span>
      ) : (
        <span style={{ color: 'var(--text-faint)' }}>—</span>
      )}
    </td>
    <td className="td whitespace-nowrap">
      {scan.vulnCounts?.total > 0 ? (
        <div className="flex items-center gap-1 text-xs">
          {scan.vulnCounts.critical > 0 && <span className="badge-critical">{scan.vulnCounts.critical}C</span>}
          {scan.vulnCounts.high     > 0 && <span className="badge-high">{scan.vulnCounts.high}H</span>}
          {scan.vulnCounts.medium   > 0 && <span className="badge-medium">{scan.vulnCounts.medium}M</span>}
          {scan.vulnCounts.low      > 0 && <span className="badge-low">{scan.vulnCounts.low}L</span>}
        </div>
      ) : (
        <span style={{ color: 'var(--text-faint)' }}>—</span>
      )}
    </td>
    <td className="td whitespace-nowrap text-xs" style={{ color: 'var(--text-muted)' }}>
      {new Date(scan.createdAt).toLocaleDateString()}{' '}
      {new Date(scan.createdAt).toLocaleTimeString()}
    </td>
    <td className="td whitespace-nowrap text-right">
      {scan.status === 'completed' ? (
        <Link
          to={`/results/${scan._id}`}
          className="inline-flex items-center gap-1 text-xs"
          style={{ color: 'var(--accent)' }}
        >
          <EyeIcon className="w-3.5 h-3.5" /> View
        </Link>
      ) : (
        <span style={{ color: 'var(--text-faint)' }} className="text-xs">—</span>
      )}
    </td>
  </tr>
);

// ── Main component ────────────────────────────────────────────────────────────

const Targets = () => {
  const [targets, setTargets]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [expanded, setExpanded]   = useState(new Set());
  const [scanning, setScanning]   = useState({});
  const navigate = useNavigate();

  useEffect(() => { fetchTargets(); }, []);

  const fetchTargets = async () => {
    try {
      const res   = await scanAPI.getScans();
      const scans = res.data.data || res.data.scans || [];
      setTargets(groupByTarget(scans));
    } catch {
      setError('Failed to load targets. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (host) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(host) ? next.delete(host) : next.add(host);
      return next;
    });
  };

  const handleScanAgain = async (targetUrl) => {
    setScanning((prev) => ({ ...prev, [targetUrl]: true }));
    try {
      const res = await scanAPI.createScan({ targetUrl });
      const id  = res.data.data?._id || res.data._id;
      // Refresh list then navigate to the new scan
      await fetchTargets();
      if (id) navigate(`/results/${id}`);
    } catch {
      setError(`Failed to start scan for ${targetUrl}`);
    } finally {
      setScanning((prev) => ({ ...prev, [targetUrl]: false }));
    }
  };

  if (loading) return <TargetsSkeleton />;

  return (
    <div className="px-4 py-6 sm:px-0">

      {/* ── Header ── */}
      <div className="mb-8 flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="page-title">Targets</h1>
          <p className="page-subtitle">Manage your scanned domains and targets</p>
        </div>
        <Link to="/scan" className="btn-primary">
          <MagnifyingGlassIcon className="w-4 h-4" />
          New Scan
        </Link>
      </div>

      {error && <div className="alert-error mb-6">{error}</div>}

      {/* ── Summary strip ── */}
      {targets.length > 0 && (
        <div
          className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6"
        >
          {[
            { label: 'Unique Targets',  value: targets.length },
            { label: 'Total Scans',     value: targets.reduce((s, t) => s + t.scanCount, 0) },
            {
              label: 'Completed Scans',
              value: targets.reduce(
                (s, t) => s + t.allScans.filter((sc) => sc.status === 'completed').length, 0
              ),
            },
            {
              label: 'Avg Risk Score',
              value: (() => {
                const scored = targets
                  .map((t) => t.latest.riskScore)
                  .filter((v) => v != null);
                return scored.length
                  ? `${Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)}/100`
                  : '—';
              })(),
            },
          ].map(({ label, value }) => (
            <div key={label} className="card py-4">
              <p className="label mb-1">{label}</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div className="card p-0 overflow-hidden">
        {targets.length === 0 ? (
          <div className="text-center py-16 px-6">
            <GlobeAltIcon
              className="mx-auto h-14 w-14 mb-4"
              style={{ color: 'var(--text-faint)' }}
            />
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>
              No targets yet
            </h3>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Run your first scan to see targets appear here.
            </p>
            <Link to="/scan" className="btn-primary">
              <MagnifyingGlassIcon className="w-4 h-4" />
              Start First Scan
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  {['Target URL', 'Last Status', 'Risk Score', 'Findings', 'Last Scanned', 'Actions'].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {targets.map(({ host, latest, scanCount, allScans }) => {
                  const isExpanded  = expanded.has(host);
                  const isScanning  = scanning[latest.targetUrl];
                  const hasHistory  = scanCount > 1;

                  return (
                    <>
                      {/* ── Primary row ── */}
                      <tr key={host} className="tr-hover">

                        {/* Target URL */}
                        <td className="td">
                          <div className="flex items-center gap-3">
                            {/* Expand toggle */}
                            {hasHistory ? (
                              <button
                                onClick={() => toggleExpand(host)}
                                title={isExpanded ? 'Collapse history' : `Show ${scanCount} scans`}
                                className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors text-xs font-bold"
                                style={{
                                  backgroundColor: 'var(--bg-tertiary)',
                                  color: 'var(--text-muted)',
                                  border: '1px solid var(--border-color)',
                                }}
                              >
                                {isExpanded ? '−' : '+'}
                              </button>
                            ) : (
                              <GlobeAltIcon
                                className="w-5 h-5 flex-shrink-0"
                                style={{ color: 'var(--accent)' }}
                              />
                            )}

                            <div className="min-w-0">
                              <div
                                className="text-sm font-semibold truncate max-w-xs"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {host}
                              </div>
                              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {scanCount} scan{scanCount !== 1 ? 's' : ''}
                                {' · '}
                                <span className="truncate">{latest.targetUrl}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Last status */}
                        <td className="td whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <StatusIcon status={latest.status} />
                            <span className={`status-${latest.status}`}>{latest.status}</span>
                          </div>
                        </td>

                        {/* Risk score */}
                        <td className="td whitespace-nowrap">
                          {latest.riskScore != null ? (
                            <div>
                              <span
                                className="text-sm font-bold"
                                style={{ color: scoreColor(latest.riskScore) }}
                              >
                                {latest.riskScore}/100
                              </span>
                              <div className="text-xs" style={{ color: scoreColor(latest.riskScore) }}>
                                {scoreLabel(latest.riskScore)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                        </td>

                        {/* Findings */}
                        <td className="td whitespace-nowrap">
                          {latest.vulnCounts?.total > 0 ? (
                            <div className="flex items-center gap-1 flex-wrap">
                              {latest.vulnCounts.critical > 0 && (
                                <span className="badge-critical">{latest.vulnCounts.critical}C</span>
                              )}
                              {latest.vulnCounts.high > 0 && (
                                <span className="badge-high">{latest.vulnCounts.high}H</span>
                              )}
                              {latest.vulnCounts.medium > 0 && (
                                <span className="badge-medium">{latest.vulnCounts.medium}M</span>
                              )}
                              {latest.vulnCounts.low > 0 && (
                                <span className="badge-low">{latest.vulnCounts.low}L</span>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-faint)' }}>—</span>
                          )}
                        </td>

                        {/* Last scanned */}
                        <td className="td whitespace-nowrap text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {new Date(latest.createdAt).toLocaleDateString()}
                          <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>
                            {new Date(latest.createdAt).toLocaleTimeString()}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="td whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {latest.status === 'completed' && (
                              <Link
                                to={`/results/${latest._id}`}
                                className="btn-secondary py-1 px-2 text-xs"
                              >
                                <EyeIcon className="w-3.5 h-3.5" />
                                View
                              </Link>
                            )}
                            <button
                              onClick={() => handleScanAgain(latest.targetUrl)}
                              disabled={isScanning || latest.status === 'running'}
                              className="btn-primary py-1 px-2 text-xs disabled:opacity-50"
                            >
                              {isScanning ? (
                                <>
                                  <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                  Scanning…
                                </>
                              ) : (
                                <>
                                  <ArrowPathIcon className="w-3.5 h-3.5" />
                                  Scan Again
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* ── Expanded history rows ── */}
                      {isExpanded && allScans.slice(1).map((scan) => (
                        <HistoryRow key={scan._id} scan={scan} />
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Footer note ── */}
      {targets.length > 0 && (
        <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-faint)' }}>
          Targets are grouped by hostname from your scan history.
          Click <strong style={{ color: 'var(--text-muted)' }}>+</strong> on any row to expand previous scans.
        </p>
      )}
    </div>
  );
};

export default Targets;
