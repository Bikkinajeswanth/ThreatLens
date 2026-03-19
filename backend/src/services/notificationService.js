const nodemailer = require('nodemailer');
const axios      = require('axios');
const logger     = require('../utils/logger');

// ─── EMAIL TRANSPORT ──────────────────────────────────────────────────────────

function createTransport() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function severityEmoji(sev) {
  return { critical: '🔴', high: '🟠', medium: '🟡', low: '🟢' }[sev] || '⚪';
}

function buildEmailHtml(scan, highFindings) {
  const rows = highFindings.slice(0, 10).map((f) =>
    `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #334155">${severityEmoji(f.severity)} ${f.name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #334155;text-transform:uppercase;font-weight:bold;color:${
        f.severity === 'critical' ? '#dc2626' : '#ea580c'
      }">${f.severity}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #334155;font-size:12px">${f.recommendation || '—'}</td>
    </tr>`
  ).join('');

  return `
  <div style="font-family:sans-serif;background:#0f172a;color:#f1f5f9;padding:24px;border-radius:8px">
    <h2 style="color:#3b82f6;margin-top:0">⚠️ ThreatLens Security Alert</h2>
    <p>High/Critical vulnerabilities were detected during a scan of <strong>${scan.targetUrl}</strong>.</p>
    <p>Security Score: <strong style="color:${scan.riskScore >= 60 ? '#22c55e' : '#ef4444'}">${scan.riskScore}/100</strong></p>
    <table style="width:100%;border-collapse:collapse;margin-top:16px">
      <thead>
        <tr style="background:#1e293b">
          <th style="padding:8px 10px;text-align:left">Finding</th>
          <th style="padding:8px 10px;text-align:left">Severity</th>
          <th style="padding:8px 10px;text-align:left">Recommendation</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="margin-top:20px;font-size:12px;color:#64748b">ThreatLens Security Platform</p>
  </div>`;
}

// ─── EMAIL ALERT ──────────────────────────────────────────────────────────────

async function sendEmailAlert(toEmail, scan, highFindings) {
  const transport = createTransport();
  if (!transport) {
    logger.warn('Email alerts not configured (SMTP_HOST missing)');
    return;
  }

  try {
    await transport.sendMail({
      from:    process.env.SMTP_FROM || 'alerts@threatlens.io',
      to:      toEmail,
      subject: `🚨 ThreatLens Alert: ${highFindings.length} High/Critical findings on ${scan.targetUrl}`,
      html:    buildEmailHtml(scan, highFindings)
    });
    logger.info(`Email alert sent to ${toEmail} for scan ${scan._id}`);
  } catch (err) {
    logger.error(`Email alert failed: ${err.message}`);
  }
}

// ─── SLACK ALERT ──────────────────────────────────────────────────────────────

async function sendSlackAlert(webhookUrl, scan, highFindings) {
  if (!webhookUrl) return;

  const fields = highFindings.slice(0, 5).map((f) => ({
    type: 'mrkdwn',
    text: `${severityEmoji(f.severity)} *${f.name}* (${f.severity.toUpperCase()})`
  }));

  const payload = {
    text: `🚨 *ThreatLens Security Alert*`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚨 *Security Alert* — ${highFindings.length} high/critical findings on *${scan.targetUrl}*\nSecurity Score: *${scan.riskScore}/100*`
        }
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: fields.length ? fields : [{ type: 'mrkdwn', text: 'No details available' }]
      }
    ]
  };

  try {
    await axios.post(webhookUrl, payload, { timeout: 5000 });
    logger.info(`Slack alert sent for scan ${scan._id}`);
  } catch (err) {
    logger.error(`Slack alert failed: ${err.message}`);
  }
}

// ─── MAIN DISPATCH ────────────────────────────────────────────────────────────

/**
 * Dispatch alerts for a completed scan.
 * user  — Mongoose User document (may be null for anonymous scans)
 * scan  — Mongoose Scan document with findings populated
 */
async function dispatchAlerts(user, scan) {
  const findings = scan.findings || [];
  const highFindings = findings.filter((f) =>
    ['critical', 'high'].includes((f.severity || '').toLowerCase())
  );

  if (highFindings.length === 0) return;

  const minSev = user?.notifications?.minSeverity || 'high';
  const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const filtered = highFindings.filter(
    (f) => (sevOrder[f.severity] ?? 99) <= (sevOrder[minSev] ?? 1)
  );
  if (filtered.length === 0) return;

  const tasks = [];

  if (user?.notifications?.email !== false && user?.email) {
    tasks.push(sendEmailAlert(user.email, scan, filtered));
  }

  const slackWebhook = user?.notifications?.slackWebhook || process.env.SLACK_WEBHOOK_URL;
  if (user?.notifications?.slack && slackWebhook) {
    tasks.push(sendSlackAlert(slackWebhook, scan, filtered));
  }

  await Promise.allSettled(tasks);
}

module.exports = { dispatchAlerts, sendEmailAlert, sendSlackAlert };
