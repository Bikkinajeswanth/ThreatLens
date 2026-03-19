// OWASP Top 10 2021 mapping
// Each entry: { id, name, description, types[] }
const OWASP_TOP10 = [
  {
    id: 'A01:2021', name: 'Broken Access Control',
    description: 'Restrictions on authenticated users are not properly enforced.',
    types: ['cors_misconfiguration', 'missing_auth', 'idor']
  },
  {
    id: 'A02:2021', name: 'Cryptographic Failures',
    description: 'Failures related to cryptography that expose sensitive data.',
    types: ['insecure_transport', 'weak_tls', 'expired_certificate', 'self_signed_certificate',
            'expiring_certificate', 'tls_error', 'no_https']
  },
  {
    id: 'A03:2021', name: 'Injection',
    description: 'User-supplied data is not validated, filtered, or sanitised.',
    types: ['injection', 'xss', 'sqli', 'command_injection']
  },
  {
    id: 'A04:2021', name: 'Insecure Design',
    description: 'Missing or ineffective control design.',
    types: ['no_https_redirect', 'server_error', 'unreachable']
  },
  {
    id: 'A05:2021', name: 'Security Misconfiguration',
    description: 'Missing hardening, misconfigured permissions, unnecessary features enabled.',
    types: ['missing_header', 'cors_misconfiguration', 'server_error', 'no_https_redirect',
            'information_disclosure', 'exposed_api']
  },
  {
    id: 'A06:2021', name: 'Vulnerable and Outdated Components',
    description: 'Using components with known vulnerabilities.',
    types: ['outdated_software', 'tech_disclosure']
  },
  {
    id: 'A07:2021', name: 'Identification and Authentication Failures',
    description: 'Weaknesses in authentication and session management.',
    types: ['cookie_security', 'missing_auth', 'weak_password_policy']
  },
  {
    id: 'A08:2021', name: 'Software and Data Integrity Failures',
    description: 'Code and infrastructure that does not protect against integrity violations.',
    types: ['missing_sri', 'insecure_deserialization']
  },
  {
    id: 'A09:2021', name: 'Security Logging and Monitoring Failures',
    description: 'Insufficient logging, monitoring, and incident response.',
    types: ['no_logging', 'missing_monitoring']
  },
  {
    id: 'A10:2021', name: 'Server-Side Request Forgery',
    description: 'SSRF flaws allow attackers to induce the server to make requests.',
    types: ['ssrf']
  }
];

// Build a fast lookup: finding.type → OWASP entry
const TYPE_TO_OWASP = {};
for (const entry of OWASP_TOP10) {
  for (const t of entry.types) {
    TYPE_TO_OWASP[t] = entry;
  }
}

// Category-level fallback mapping
const CATEGORY_TO_OWASP = {
  'TLS':                    OWASP_TOP10[1],  // A02
  'Configuration':          OWASP_TOP10[4],  // A05
  'Information Disclosure': OWASP_TOP10[4],  // A05
  'Authentication':         OWASP_TOP10[6],  // A07
  'Network':                OWASP_TOP10[4],  // A05
  'Injection':              OWASP_TOP10[2],  // A03
  'API':                    OWASP_TOP10[4],  // A05
};

/**
 * Annotate an array of findings in-place with owaspCategory + owaspName.
 * Returns the same array.
 */
function mapToOwasp(findings) {
  for (const f of findings) {
    const entry =
      TYPE_TO_OWASP[f.type] ||
      CATEGORY_TO_OWASP[f.category] ||
      null;

    if (entry) {
      f.owaspCategory = entry.id;
      f.owaspName     = entry.name;
    }
  }
  return findings;
}

/**
 * Summarise OWASP coverage from a findings array.
 * Returns [{ id, name, count }] sorted by count desc.
 */
function getOwaspSummary(findings) {
  const counts = {};
  for (const f of findings) {
    if (!f.owaspCategory) continue;
    const key = f.owaspCategory;
    if (!counts[key]) counts[key] = { id: f.owaspCategory, name: f.owaspName, count: 0 };
    counts[key].count++;
  }
  return Object.values(counts).sort((a, b) => b.count - a.count);
}

module.exports = { mapToOwasp, getOwaspSummary, OWASP_TOP10 };
