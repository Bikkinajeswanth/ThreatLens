// Base deduction per severity level
const SEVERITY_DEDUCTIONS = {
  critical: 30,
  high:     20,
  medium:   10,
  low:       5
};

// Category multipliers — some categories carry more weight
const CATEGORY_MULTIPLIERS = {
  'TLS':                  1.3,
  'Authentication':       1.2,
  'Injection':            1.4,
  'Network':              1.1,
  'Configuration':        1.0,
  'Information Disclosure': 0.9,
  'Other':                0.8
};

/**
 * Count findings by severity level.
 * Returns { critical, high, medium, low, total }
 */
function getSeverityCounts(findings) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  for (const f of (findings || [])) {
    const sev = (f.severity || 'low').toLowerCase();
    if (counts[sev] !== undefined) {
      counts[sev]++;
      counts.total++;
    }
  }
  return counts;
}

/**
 * Count findings by category.
 * Returns { [categoryName]: count }
 */
function getCategoryCounts(findings) {
  const counts = {};
  for (const f of (findings || [])) {
    const cat = f.category || 'Other';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  return counts;
}

/**
 * Calculate a 0–100 risk score from findings.
 *
 * Algorithm:
 *  - Start at 100
 *  - For each finding: deduct (baseSeverityPoints × categoryMultiplier × diminishingFactor)
 *  - Diminishing factor = 0.5^i so the 2nd finding of the same severity costs half, 3rd a quarter, etc.
 *  - Floor at 0
 */
function calculateRiskScore(findings) {
  if (!findings || findings.length === 0) return 100;

  // Group by (severity, category) key for diminishing returns per group
  const groups = {};
  for (const f of findings) {
    const sev = (f.severity || 'low').toLowerCase();
    const cat = f.category || 'Other';
    const key = `${sev}::${cat}`;
    if (!groups[key]) groups[key] = { sev, cat, count: 0 };
    groups[key].count++;
  }

  let deduction = 0;
  for (const { sev, cat, count } of Object.values(groups)) {
    const base       = SEVERITY_DEDUCTIONS[sev] ?? 5;
    const multiplier = CATEGORY_MULTIPLIERS[cat] ?? 1.0;
    for (let i = 0; i < count; i++) {
      deduction += base * multiplier * Math.pow(0.5, i);
    }
  }

  return Math.max(0, Math.round(100 - deduction));
}

function getRiskLabel(score) {
  if (score >= 80) return 'Low Risk';
  if (score >= 60) return 'Medium Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
}

function getRiskColor(score) {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  if (score >= 40) return 'orange';
  return 'red';
}

module.exports = {
  calculateRiskScore,
  getSeverityCounts,
  getCategoryCounts,
  getRiskLabel,
  getRiskColor
};
