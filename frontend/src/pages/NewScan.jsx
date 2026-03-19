import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scanAPI } from '../services/api';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

const SCAN_STEPS = [
  { n: 1, title: 'URL Validation',       desc: 'Verify target accessibility and basic security' },
  { n: 2, title: 'Security Headers',     desc: 'Check HTTP security headers and cookie flags' },
  { n: 3, title: 'TLS / SSL Analysis',   desc: 'Inspect certificate validity and protocol strength' },
  { n: 4, title: 'Port Scanning',        desc: 'Detect exposed network services and open ports' },
  { n: 5, title: 'Technology Detection', desc: 'Fingerprint server stack and frameworks' },
  { n: 6, title: 'Report Generation',    desc: 'Compile findings and generate PDF report' },
];

const NewScan = () => {
  const [url, setUrl]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate URL before sending — catches missing protocol etc.
      try { new URL(url); } catch {
        setError('Please enter a valid URL including the protocol, e.g. https://example.com');
        setLoading(false);
        return;
      }
      await scanAPI.createScan({ targetUrl: url });
      navigate('/history', { state: { message: 'Scan created successfully!' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create scan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-0">

      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="page-title">New Vulnerability Scan</h1>
        <p className="page-subtitle">Enter a URL to scan for security vulnerabilities</p>
      </div>

      <div className="max-w-2xl">

        {/* ── Scan form card ── */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Error banner */}
            {error && (
              <div className="alert-error">{error}</div>
            )}

            {/* Target URL field */}
            <div>
              <label
                htmlFor="url"
                className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Target URL
              </label>
              <div className="relative">
                <input
                  type="text"
                  id="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="input-field pl-10"
                  placeholder="https://example.com"
                  autoComplete="url"
                  spellCheck={false}
                />
                <MagnifyingGlassIcon
                  className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}
                />
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                Enter the complete URL including protocol (http:// or https://)
              </p>
            </div>

            {/* Scan information box */}
            <div
              className="rounded-lg p-4"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <h3
                className="text-sm font-semibold mb-2"
                style={{ color: 'var(--text-secondary)' }}
              >
                Scan Information
              </h3>
              <ul className="text-sm space-y-1" style={{ color: 'var(--text-muted)' }}>
                <li>• SSL/TLS configuration analysis</li>
                <li>• HTTP security headers check</li>
                <li>• Port scanning and service detection</li>
                <li>• Content security analysis</li>
                <li>• Technology stack identification</li>
              </ul>
            </div>

            {/* Action buttons */}
            <div
              className="flex justify-end gap-3 pt-4 mt-2"
              style={{ borderTop: '1px solid var(--border-color)' }}
            >
              <button
                type="button"
                onClick={() => { setUrl(''); setError(''); navigate('/history'); }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="btn-primary"
              >
                {loading ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Starting Scan…
                  </>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="h-4 w-4" />
                    Start Scan
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* ── Scan process card ── */}
        <div className="card mt-6">
          <h3
            className="text-base font-semibold mb-4"
            style={{ color: 'var(--text-primary)' }}
          >
            Scan Process
          </h3>

          <div className="space-y-4">
            {SCAN_STEPS.map(({ n, title, desc }) => (
              <div key={n} className="flex items-start gap-3">
                {/* Step number bubble */}
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {n}
                </div>
                <div>
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default NewScan;
