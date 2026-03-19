const cron   = require('node-cron');
const Target = require('../models/Target');
const Scan   = require('../models/Scan');
const User   = require('../models/User');
const { runScan }           = require('../services/vulnerabilityScanner');
const { calculateRiskScore, getSeverityCounts } = require('../services/riskScore');
const { generateReport }    = require('../services/reportGenerator');
const { dispatchAlerts }    = require('../services/notificationService');
const logger = require('../utils/logger');

// Compute next run date from frequency
function nextRunDate(frequency) {
  const d = new Date();
  if (frequency === 'daily')   d.setDate(d.getDate() + 1);
  if (frequency === 'weekly')  d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

async function runScheduledScans() {
  const now = new Date();
  const dueTargets = await Target.find({
    'schedule.enabled': true,
    'schedule.nextRunAt': { $lte: now }
  }).populate('userId');

  if (dueTargets.length === 0) return;
  logger.info(`Scheduled scans: ${dueTargets.length} target(s) due`);

  for (const target of dueTargets) {
    try {
      const scan = await Scan.create({
        targetUrl: target.url,
        status:    'running',
        startedAt: new Date(),
        userId:    target.userId?._id || null
      });

      const { findings, metadata } = await runScan(target.url);
      const riskScore  = calculateRiskScore(findings);
      const vulnCounts = getSeverityCounts(findings);

      scan.findings    = findings;
      scan.riskScore   = riskScore;
      scan.vulnCounts  = vulnCounts;
      scan.metadata    = metadata;
      scan.status      = 'completed';
      scan.completedAt = new Date();
      await scan.save();

      // Generate PDF
      try {
        const reportPath = await generateReport(scan);
        scan.reportPath  = reportPath;
        await scan.save();
      } catch (e) {
        logger.error(`Scheduled scan PDF error: ${e.message}`);
      }

      // Update target
      target.lastScanId    = scan._id;
      target.lastRiskScore = riskScore;
      target.schedule.lastRunAt = new Date();
      target.schedule.nextRunAt = nextRunDate(target.schedule.frequency);
      await target.save();

      // Dispatch alerts
      await dispatchAlerts(target.userId, scan);

      logger.info(`Scheduled scan complete for ${target.url} — score: ${riskScore}`);
    } catch (err) {
      logger.error(`Scheduled scan failed for ${target.url}: ${err.message}`);
      // Advance nextRunAt so we don't retry immediately
      target.schedule.nextRunAt = nextRunDate(target.schedule.frequency);
      await target.save();
    }
  }
}

// Run every hour — checks for due targets
function startScheduler() {
  cron.schedule('0 * * * *', () => {
    runScheduledScans().catch((err) =>
      logger.error(`Scheduler error: ${err.message}`)
    );
  });
  logger.info('Scan scheduler started (runs every hour)');
}

module.exports = { startScheduler, runScheduledScans };
