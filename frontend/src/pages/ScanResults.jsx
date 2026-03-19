import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { scanAPI, reportAPI } from '../services/api';
import { useChartTheme } from '../hooks/useChartTheme';
import {
  ArrowLeftIcon, ExclamationTriangleIcon, ShieldCheckIcon,
  InformationCircleIcon, ArrowDownTrayIcon, TagIcon, GlobeAltIcon,
} from '@heroicons/react/24/outline';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ── Palette (fixed — severity colors don't change with theme) ─────────────────
const SEV_COLOR = {
  critical: '#dc2626', high: '#ea580c',
  medium: '#d97706', low: '#16a34a', info: '#6b7280',
};
const CAT_COLOR = {
  'Configuration': '#6366f1', 'Network': '#0ea5e9',
  'Information Disclosure': '#f59e0b', 'Injection': '#ef4444',
  'Authentication': '#8b5cf6', 'TLS': '#10b981', 'Other': '#6b7280',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const scoreColor = (s) => {
  if (s >= 80) return '#16a34a';
  if (s >= 60) return '#d97706';
  if (s >= 40) return '#ea580c';
  return '#dc2626';
};
const scoreLabel = (s) => {
  if (s >= 80) return 'Low Risk';
  if (s >= 60) return 'Medium Risk';
  if (s >= 40) return 'High Risk';
  return 'Critical Risk';
};

// ── Sub-components ────────────────────────────────────────────────────────────
const SeverityIcon = ({ severity }) => {
  const s = (severity || '').toLowerCase();
  if (s === 'critical' || s === 'high')
    return <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-red-500" />;
  if (s === 'medium')
    return <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0 text-yellow-500" />;
  if (s === 'low')
    return <InformationCircleIcon className="w-4 h-4 flex-shrink-0 text-green-500" />;
  return <ShieldCheckIcon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />;
};

const SeverityBadge = ({ severity }) => {
  const s = (severity || 'info').toLowerCase();
  const cls = {
    critical: 'badge-critical', high: 'badge-high',
    medium: 'badge-medium', low: 'badge-low', info: 'badge-info',
  };
  return (
    <span className={`${cls[s] || 'badge-info'} flex-shrink-0`}>
      {s.toUpperCase()}
    </span>
  );
};

const CategoryBadge = ({ category }) => {
  const color = CAT_COLOR[category] || CAT_COLOR.Other;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded font-medium"
      style={{ backgroundColor: `${color}22`, color, border: `1px solid ${color}55` }}
    >
      <TagIcon className="w-3 h-3" />
      {category || 'Other'}
    </span>
  );
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
const ResultsSkeleton = () => (
  <div className="px-4 py-6 sm:px-0 animate-pulse">
    <div className="skeleton h-4 w-32 mb-6 rounded" />
    <div className="skeleton h-8 w-56 mb-2 rounded" />
    <div className="skeleton h-4 w-80 mb-8 rounded" />
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
      <div className="lg:col-span-2 card"><div className="skeleton h-48 rounded" /></div>
      <div className="card"><div className="skeleton h-48 rounded" /></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      {[0, 1].map((i) => <div key={i} className="card"><div className="skeleton h-40 rounded" /></div>)}
    </div>
    <div className="card"><div className="skeleton h-64 rounded" /></div>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const ScanResults = () => {
  const { id } = useParams();
  const [scan, setScan]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [downloading, setDownloading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const pollRef = useRef(null);
  const chart   = useChartTheme();

  useEffect(() => {
    fetchScan();
    return () => clearInterval(pollRef.current);
  }, [id]);

  const fetchScan = async () => {
    try {
      const res  = await scanAPI.getScan(id);
      const data = res.data.data || res.data.scan;
      setScan(data);
      if (data.status === 'running' || data.status === 'pending') {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(fetchScan, 3000);
      } else {
        clearInterval(pollRef.current);
      }
    } catch {
      setError('Failed to fetch scan results');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res  = await reportAPI.downloadReport(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `threatlens-report-${id}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); window.URL.revokeObjectURL(url);
    } catch {
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  // ── States ──────────────────────────────────────────────────────────────────
  if (loading) return <ResultsSkeleton />;

  if (error || !scan) return (
    <div className="px-4 py-6 sm:px-0 text-center">
      <ExclamationTriangleIcon className="mx-auto h-12 w-12 text-red-500" />
      <h3 className="mt-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
        Error Loading Results
      </h3>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{error}</p>
      <div className="mt-6"><Link to="/history" className="btn-primary">Back to History</Link></div>
    </div>
  );

  if (scan.status === 'running' || scan.status === 'pending') return (
    <div className="px-4 py-6 sm:px-0">
      <Link to="/history" className="inline-flex items-center gap-2 mb-6 text-sm font-medium"
        style={{ color: 'var(--accent)' }}>
        <ArrowLeftIcon className="w-4 h-4" /> Back to Scan History
      </Link>
      <div className="card text-center py-16">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 mx-auto mb-4"
          style={{ borderColor: 'var(--accent)' }} />
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          Scan In Progress
        </h2>
        <p style={{ color: 'var(--text-muted)' }}>Analysing {scan.targetUrl}</p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-faint)' }}>
          This page updates automatically…
        </p>
      </div>
    </div>
  );

  // ── Data ────────────────────────────────────────────────────────────────────
  const findings   = scan.findings || [];
  const score      = scan.riskScore ?? 0;
  const severities = ['critical', 'high', 'medium', 'low'];

  const severityCounts = severities.map((s) => ({
    name:  s.charAt(0).toUpperCase() + s.slice(1),
    value: findings.filter((f) => (f.severity || '').toLowerCase() === s).length,
    color: SEV_COLOR[s],
  })).filter((s) => s.value > 0);

  const catMap = {};
  for (const f of findings) {
    const c = f.category || 'Other';
    catMap[c] = (catMap[c] || 0) + 1;
  }
  const categoryData = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value, color: CAT_COLOR[name] || CAT_COLOR.Other }));

  const allCategories = ['All', ...Object.keys(catMap)];

  const filteredFindings = [...findings]
    .filter((f) => activeCategory === 'All' || (f.category || 'Other') === activeCategory)
    .sort((a, b) => {
      const o = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      return (o[a.severity] ?? 5) - (o[b.severity] ?? 5);
    });

  const techStack = (scan.metadata?.detectedTech || []).map((t) =>
    typeof t === 'object' ? t : { name: t, category: 'Unknown' }
  );

  return (
    <div className="px-4 py-6 sm:px-0">

      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <Link to="/history" className="inline-flex items-center gap-2 text-sm font-medium"
          style={{ color: 'var(--accent)' }}>
          <ArrowLeftIcon className="w-4 h-4" /> Back to Scan History
        </Link>
        {scan.status === 'completed' && (
          <button onClick={handleDownload} disabled={downloading} className="btn-primary">
            {downloading
              ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />Downloading…</>
              : <><ArrowDownTrayIcon className="w-4 h-4" />Download PDF Report</>
            }
          </button>
        )}
      </div>

      <h1 className="page-title mb-1">Scan Results</h1>
      <p className="mb-6 text-sm truncate" style={{ color: 'var(--text-muted)' }}>{scan.targetUrl}</p>

      {/* ── Row 1: Info + Score ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

        {/* Scan info */}
        <div className="lg:col-span-2 card">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
            Scan Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {[
              ['Target URL',     scan.targetUrl],
              ['Status',         scan.status.toUpperCase()],
              ['Started',        new Date(scan.createdAt).toLocaleString()],
              ['Completed',      scan.completedAt ? new Date(scan.completedAt).toLocaleString() : '—'],
              ['Duration',       scan.completedAt
                ? `${Math.round((new Date(scan.completedAt) - new Date(scan.createdAt)) / 1000)}s` : '—'],
              ['HTTP Status',    scan.metadata?.statusCode ?? '—'],
              ['Open Ports',     (scan.metadata?.openPorts || []).join(', ') || 'None detected'],
              ['Total Findings', findings.length],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="label">{label}</dt>
                <dd className="mt-0.5 break-all" style={{ color: 'var(--text-primary)' }}>
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Risk score */}
        <div className="card flex flex-col items-center justify-center text-center py-6">
          <h2 className="text-base font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
            Security Score
          </h2>
          <div className="text-7xl font-black" style={{ color: scoreColor(score) }}>{score}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>out of 100</div>
          <div className="mt-1 text-sm font-bold" style={{ color: scoreColor(score) }}>
            {scoreLabel(score)}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 w-full text-xs">
            {severities.map((s) => {
              const count = findings.filter((f) => (f.severity || '').toLowerCase() === s).length;
              return (
                <div key={s} className="flex items-center justify-between rounded px-2 py-1.5"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="capitalize" style={{ color: 'var(--text-secondary)' }}>{s}</span>
                  <span className="font-bold" style={{ color: SEV_COLOR[s] }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Row 2: Charts ── */}
      {(severityCounts.length > 0 || categoryData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {severityCounts.length > 0 && (
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Severity Distribution
              </h2>
              <div className="flex items-center gap-6">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie data={severityCounts} cx="50%" cy="50%"
                      innerRadius={40} outerRadius={72} dataKey="value">
                      {severityCounts.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip {...chart.tooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {severityCounts.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                      </div>
                      <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {categoryData.length > 0 && (
            <div className="card">
              <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                Findings by Category
              </h2>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} horizontal={false} />
                  <XAxis type="number" tick={{ fill: chart.tick, fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: chart.tick, fontSize: 10 }} width={130} />
                  <Tooltip {...chart.tooltip} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tech Stack ── */}
      {techStack.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2"
            style={{ color: 'var(--text-primary)' }}>
            <GlobeAltIcon className="w-5 h-5" style={{ color: 'var(--accent)' }} />
            Detected Technology Stack
          </h2>
          <div className="flex flex-wrap gap-2">
            {techStack.map((tech, i) => (
              <span key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
                {tech.name}
                {tech.category && tech.category !== 'Unknown' && (
                  <span style={{ color: 'var(--text-faint)' }}>· {tech.category}</span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Findings ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
            Findings
            <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
              ({filteredFindings.length}{activeCategory !== 'All' ? ` in ${activeCategory}` : ''})
            </span>
          </h2>
        </div>

        {/* Category filter tabs */}
        {allCategories.length > 2 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {allCategories.map((cat) => {
              const active = activeCategory === cat;
              const color  = cat === 'All' ? '#6366f1' : (CAT_COLOR[cat] || '#6b7280');
              return (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                  style={active
                    ? { backgroundColor: color, color: '#fff' }
                    : { backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)' }
                  }>
                  {cat}
                  {cat !== 'All' && catMap[cat] && (
                    <span className="ml-1.5" style={{ opacity: 0.7 }}>{catMap[cat]}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {filteredFindings.length === 0 ? (
          <div className="text-center py-10">
            <ShieldCheckIcon className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
              {activeCategory === 'All' ? 'No vulnerabilities detected' : `No findings in "${activeCategory}"`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFindings.map((f, i) => (
              <div key={i} className="rounded-lg p-4 transition-colors"
                style={{
                  border: `1px solid var(--border-color)`,
                  borderLeft: `3px solid ${SEV_COLOR[(f.severity || 'info').toLowerCase()]}`,
                }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <SeverityIcon severity={f.severity} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {f.name}
                        </h3>
                        <CategoryBadge category={f.category} />
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                        {f.description}
                      </p>
                      {f.recommendation && (
                        <div className="mt-2 p-2 rounded text-xs"
                          style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                          <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                            Recommendation:{' '}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{f.recommendation}</span>
                        </div>
                      )}
                      {f.port && (
                        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-faint)' }}>
                          <span className="font-medium">Port:</span> {f.port}
                        </p>
                      )}
                    </div>
                  </div>
                  <SeverityBadge severity={f.severity} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScanResults;
