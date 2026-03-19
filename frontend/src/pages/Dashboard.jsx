import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { scanAPI } from '../services/api';
import { useChartTheme } from '../hooks/useChartTheme';
import {
  MagnifyingGlassIcon, CheckCircleIcon,
  ExclamationTriangleIcon, ClockIcon, ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend,
} from 'recharts';

// ── Severity / category palette (fixed — not theme-dependent) ─────────────────
const SEV_COLORS = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a',
};
const CAT_COLORS = {
  'Configuration': '#6366f1', 'Network': '#0ea5e9',
  'Information Disclosure': '#f59e0b', 'Injection': '#ef4444',
  'Authentication': '#8b5cf6', 'TLS': '#10b981', 'Other': '#6b7280',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreColor = (s) => {
  if (s == null) return 'var(--text-muted)';
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#d97706';
  if (s >= 40) return '#ea580c';
  return '#dc2626';
};
const scoreLabel = (s) => {
  if (s == null) return 'N/A';
  if (s >= 80) return 'Low Risk';
  if (s >= 60) return 'Medium Risk';
  if (s >= 40) return 'High Risk';
  return 'Critical Risk';
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
const DashboardSkeleton = () => (
  <div className="px-4 py-6 sm:px-0 animate-pulse">
    <div className="skeleton h-8 w-48 mb-2 rounded" />
    <div className="skeleton h-4 w-64 mb-8 rounded" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card"><div className="skeleton h-16 rounded" /></div>
      ))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="card"><div className="skeleton h-48 rounded" /></div>
      ))}
    </div>
    <div className="card"><div className="skeleton h-48 rounded" /></div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const chart = useChartTheme();

  useEffect(() => { fetchData(); }, []);

  // ── computeStatsFromScans ────────────────────────────────────────────────────
  // Derives all four stat-card values directly from raw scan objects returned
  // by GET /api/scans.  This is the authoritative source because the backend
  // aggregation pipeline can return stale/zero values when vulnCounts fields
  // were stored as null in older documents.
  const computeStatsFromScans = (scans) => {
    // Only scans that fully completed carry meaningful riskScore / vulnCounts.
    // Mongoose always serialises vulnCounts as { critical:0, high:0, ... } even
    // for documents where the scanner never ran, so we must gate on both
    // status === 'completed' AND riskScore != null before trusting those fields.
    const completed = scans.filter((s) => s.status === 'completed');
    const completedWithScore = completed.filter((s) => s.riskScore != null);

    // ── Average risk score ───────────────────────────────────────────────────
    const averageRiskScore = completedWithScore.length
      ? Math.round(
          completedWithScore.reduce((sum, s) => sum + s.riskScore, 0)
          / completedWithScore.length
        )
      : null;

    // ── High + Critical count & full breakdown ───────────────────────────────
    // Only count vulnCounts from scans that have a riskScore (i.e. the scanner
    // pipeline actually ran and saved the counts).  For any scan without a
    // riskScore, vulnCounts will be all-zero defaults and must be ignored.
    let highVulnerabilities = 0;
    const vulnBreakdown = { critical: 0, high: 0, medium: 0, low: 0 };

    for (const s of completedWithScore) {
      const vc = s.vulnCounts;
      if (vc != null) {
        highVulnerabilities    += (vc.high     || 0) + (vc.critical || 0);
        vulnBreakdown.critical += vc.critical  || 0;
        vulnBreakdown.high     += vc.high      || 0;
        vulnBreakdown.medium   += vc.medium    || 0;
        vulnBreakdown.low      += vc.low       || 0;
      } else if (Array.isArray(s.findings)) {
        // vulnCounts genuinely absent — fall back to findings array
        for (const f of s.findings) {
          const sev = (f.severity || '').toLowerCase();
          if (sev === 'high' || sev === 'critical') highVulnerabilities++;
          if (vulnBreakdown[sev] !== undefined) vulnBreakdown[sev]++;
        }
      }
    }

    return {
      totalScans:         scans.length,
      completedScans:     completed.length,
      failedScans:        scans.filter((s) => s.status === 'failed').length,
      highVulnerabilities,
      vulnBreakdown,
      averageRiskScore,
      recentScans:        scans.slice(0, 5),
      // Only the backend aggregation endpoint can supply these
      categoryBreakdown:  [],
      scansOverTime:      [],
      mostVulnerable:     [],
    };
  };

  const fetchData = async () => {
    // Always fetch raw scans — they are the ground truth for the four stat cards.
    // The dashboard endpoint is fetched in parallel for the richer chart fields
    // (scansOverTime, mostVulnerable, categoryBreakdown) that can't be derived
    // client-side from the paginated /scans list.
    try {
      const [scanRes, dashRes] = await Promise.allSettled([
        scanAPI.getScans(),
        scanAPI.getDashboard(),
      ]);

      const scans  = scanRes.status === 'fulfilled'
        ? (scanRes.value.data.data || scanRes.value.data.scans || [])
        : [];

      // Compute the four stat-card values from raw scans (always accurate)
      const derived = computeStatsFromScans(scans);

      if (dashRes.status === 'fulfilled') {
        const db = dashRes.value.data.data || {};
        // Merge: use derived values for the four cards; keep backend-only chart data
        setStats({
          ...derived,
          categoryBreakdown: db.categoryBreakdown?.length  ? db.categoryBreakdown  : [],
          scansOverTime:     db.scansOverTime?.length      ? db.scansOverTime      : [],
          mostVulnerable:    db.mostVulnerable?.length     ? db.mostVulnerable     : [],
          // recentScans from backend may include richer fields; prefer it if available
          recentScans:       db.recentScans?.length        ? db.recentScans        : derived.recentScans,
        });
      } else {
        // Dashboard endpoint unavailable — derived stats are sufficient
        setStats(derived);
      }

      if (scanRes.status === 'rejected' && dashRes.status === 'rejected') {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const recentScans       = stats?.recentScans       || [];
  const vulnBreakdown     = stats?.vulnBreakdown     || {};
  const categoryBreakdown = stats?.categoryBreakdown || [];

  const sevChartData = ['critical', 'high', 'medium', 'low'].map((s) => ({
    name: s.charAt(0).toUpperCase() + s.slice(1),
    value: vulnBreakdown[s] || 0,
    color: SEV_COLORS[s],
  }));

  const catChartData = categoryBreakdown.map((c) => ({
    name: c.category,
    value: c.count,
    color: CAT_COLORS[c.category] || CAT_COLORS.Other,
  }));

  const scansOverTime  = stats?.scansOverTime  || [];
  const mostVulnerable = stats?.mostVulnerable || [];
  const avgScore = stats?.averageRiskScore;

  return (
    <div className="px-4 py-6 sm:px-0">

      {/* Header */}
      <div className="mb-8">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Security posture overview</p>
      </div>

      {error && <div className="alert-error mb-6">{error}</div>}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">

        {/* Total Scans */}
        <div className="card">
          <div className="flex items-center gap-3">
            <MagnifyingGlassIcon className="h-7 w-7 flex-shrink-0" style={{ color: 'var(--accent)' }} />
            <div>
              <p className="label">Total Scans</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {stats?.totalScans ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Completed */}
        <div className="card">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="h-7 w-7 flex-shrink-0 text-green-500" />
            <div>
              <p className="label">Completed</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {stats?.completedScans ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* High / Critical */}
        <div className="card">
          <div className="flex items-center gap-3">
            <ShieldExclamationIcon className="h-7 w-7 flex-shrink-0 text-red-500" />
            <div>
              <p className="label">High / Critical</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {stats?.highVulnerabilities ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Avg Score */}
        <div className="card">
          <div className="flex items-center gap-3">
            <ExclamationTriangleIcon className="h-7 w-7 flex-shrink-0 text-yellow-500" />
            <div>
              <p className="label">Avg Score</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: scoreColor(avgScore) }}>
                {avgScore != null ? avgScore : 'N/A'}
              </p>
              {avgScore != null && (
                <p className="text-xs" style={{ color: scoreColor(avgScore) }}>
                  {scoreLabel(avgScore)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Charts row 1 ── */}
      {(sevChartData.some((d) => d.value > 0) || catChartData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {sevChartData.some((d) => d.value > 0) && (
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Vulnerability Severity Breakdown
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sevChartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: chart.tick, fontSize: 12 }} />
                  <YAxis tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
                  <Tooltip {...chart.tooltip} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {sevChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {catChartData.length > 0 && (
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Findings by Category
              </h2>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={catChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: chart.tick, fontSize: 10 }} width={130} />
                  <Tooltip {...chart.tooltip} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {catChartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Scans over time ── */}
      {scansOverTime.length > 1 && (
        <div className="card mb-8">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Scans Over Time (last 30 days)
          </h2>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={scansOverTime} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="date" tick={{ fill: chart.tick, fontSize: 11 }}
                tickFormatter={(d) => d.slice(5)} />
              <YAxis tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
              <Tooltip {...chart.tooltip} />
              <Line type="monotone" dataKey="count" stroke="var(--accent)"
                strokeWidth={2} dot={{ r: 3, fill: 'var(--accent)' }}
                activeDot={{ r: 5 }} name="Scans" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Most vulnerable targets ── */}
      {mostVulnerable.length > 0 && (
        <div className="card mb-8">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Most Vulnerable Targets
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  {['Target', 'Latest Score', 'Total Findings', 'Scans'].map((h) => (
                    <th key={h} className="th">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mostVulnerable.map((t, i) => (
                  <tr key={i} className="tr-hover">
                    <td className="td">
                      <span className="text-sm font-medium truncate max-w-xs block"
                        style={{ color: 'var(--text-primary)' }}>
                        {t.targetUrl}
                      </span>
                    </td>
                    <td className="td whitespace-nowrap">
                      {t.latestScore != null ? (
                        <span className="text-sm font-bold"
                          style={{ color: scoreColor(t.latestScore) }}>
                          {t.latestScore}/100
                        </span>
                      ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                    </td>
                    <td className="td whitespace-nowrap text-sm"
                      style={{ color: 'var(--text-secondary)' }}>
                      {t.totalFindings}
                    </td>
                    <td className="td whitespace-nowrap text-sm"
                      style={{ color: 'var(--text-secondary)' }}>
                      {t.scanCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Recent scans ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Recent Scans
          </h2>
          <Link to="/history" className="text-sm" style={{ color: 'var(--accent)' }}>
            View all
          </Link>
        </div>

        {recentScans.length === 0 ? (
          <div className="text-center py-8">
            <MagnifyingGlassIcon className="mx-auto h-12 w-12" style={{ color: 'var(--text-faint)' }} />
            <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              No scans yet
            </h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              Get started by creating your first scan.
            </p>
            <div className="mt-6">
              <Link to="/scan" className="btn-primary">New Scan</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {recentScans.map((scan) => (
              <div
                key={scan._id}
                className="flex items-center justify-between p-3 rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--bg-tertiary)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={scan.status} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {scan.targetUrl}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {new Date(scan.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  {scan.riskScore != null && (
                    <span className="text-sm font-bold" style={{ color: scoreColor(scan.riskScore) }}>
                      {scan.riskScore}/100
                    </span>
                  )}
                  <StatusBadge status={scan.status} />
                  {scan.status === 'completed' && (
                    <Link
                      to={`/results/${scan._id}`}
                      className="text-sm font-medium"
                      style={{ color: 'var(--accent)' }}
                    >
                      View
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
