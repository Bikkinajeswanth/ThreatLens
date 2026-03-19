const dns = require('dns').promises;
const logger = require('../../utils/logger');

// Common subdomain prefixes to probe
const COMMON_SUBDOMAINS = [
  'www', 'mail', 'ftp', 'smtp', 'pop', 'imap', 'webmail',
  'api', 'api2', 'dev', 'staging', 'test', 'uat', 'qa',
  'admin', 'portal', 'dashboard', 'app', 'apps',
  'blog', 'shop', 'store', 'cdn', 'static', 'assets',
  'media', 'img', 'images', 'docs', 'help', 'support',
  'vpn', 'remote', 'secure', 'login', 'auth', 'sso',
  'git', 'gitlab', 'github', 'jenkins', 'ci', 'jira',
  'monitor', 'status', 'health', 'metrics', 'grafana',
  'db', 'database', 'mysql', 'postgres', 'redis', 'mongo',
  'ns1', 'ns2', 'mx', 'mx1', 'mx2'
];

/**
 * Probe a single subdomain via DNS A/AAAA lookup.
 * Returns the subdomain string if it resolves, null otherwise.
 */
async function probeSubdomain(subdomain, baseDomain) {
  const fqdn = `${subdomain}.${baseDomain}`;
  try {
    await dns.lookup(fqdn);
    return fqdn;
  } catch {
    return null;
  }
}

/**
 * Enumerate subdomains for a given hostname.
 * Runs all probes concurrently with a concurrency cap.
 * Returns an array of discovered subdomain strings.
 */
async function discoverSubdomains(hostname) {
  // Strip any existing subdomain to get the registrable domain
  // e.g. "api.example.com" → "example.com"
  const parts = hostname.split('.');
  const baseDomain = parts.length > 2
    ? parts.slice(-2).join('.')
    : hostname;

  logger.debug(`Subdomain scan: probing ${COMMON_SUBDOMAINS.length} prefixes on ${baseDomain}`);

  // Batch into groups of 20 to avoid overwhelming DNS
  const BATCH = 20;
  const found = [];

  for (let i = 0; i < COMMON_SUBDOMAINS.length; i += BATCH) {
    const batch = COMMON_SUBDOMAINS.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map((sub) => probeSubdomain(sub, baseDomain))
    );
    for (const r of results) {
      if (r && r !== hostname) found.push(r);
    }
  }

  // Deduplicate
  return [...new Set(found)].sort();
}

module.exports = { discoverSubdomains };
