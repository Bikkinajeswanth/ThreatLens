const dns = require('dns').promises;

// Private/reserved IP ranges that must never be scanned
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./,   // link-local
  /^::1$/,         // IPv6 loopback
  /^fc00:/i,       // IPv6 ULA
  /^0\.0\.0\.0$/
];

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

/**
 * Validate and sanitise a scan target URL.
 * Throws an Error with a user-friendly message on failure.
 * Returns the normalised URL string on success.
 */
async function validateTargetUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new Error('Target URL is required');
  }

  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new Error('Invalid URL format — include protocol, e.g. https://example.com');
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new Error('Only http:// and https:// URLs are allowed');
  }

  const hostname = parsed.hostname;

  // Block by hostname pattern
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new Error(`Scanning private/reserved addresses is not allowed (${hostname})`);
    }
  }

  // Resolve hostname → IP and re-check
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    for (const { address } of addresses) {
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(address)) {
          throw new Error(`Target resolves to a private IP address (${address}) — scanning not allowed`);
        }
      }
    }
  } catch (err) {
    // Re-throw our own validation errors
    if (err.message.includes('private') || err.message.includes('reserved')) throw err;
    // DNS resolution failure — let the scanner surface the real error
  }

  return parsed.toString();
}

module.exports = { validateTargetUrl };
