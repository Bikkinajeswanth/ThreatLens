const Scan   = require('../models/Scan');
const User   = require('../models/User');
const { runScan, SCAN_STEPS }  = require('../services/vulnerabilityScanner');
const { calculateRiskScore, getSeverityCounts, getCategoryCounts } = require('../services/riskScore');
const { generateReport }       = require('../services/reportGenerator');
const { dispatchAlerts }       = require('../services/notificationService');
const { validateTargetUrl }    = require('../scanners/utils/urlValidator');
const logger = require('../utils/logger');

// In-memory progress store: scanId → { step, label, pct }
const progressStore = new Map();
const progressClients = new Map(); // scanId → Set of SSE res objects

// ─── POST /api/scans ──────────────────────────────────────────────────────────
const createScan = async (req, res, next) => {
  try {
    console.log('Backend: Received scan request:', req.body);

    const rawUrl = (req.body.targetUrl || req.body.url || '').trim();
    if (!rawUrl) {
      return res.status(400).json({ success: false, message: 'targetUrl is required' });
    }

    let targetUrl;
    try {
      targetUrl = await validateTargetUrl(rawUrl);
    } catch (validationErr) {
      return res.status(400).json({ success: false, message: validationErr.message });
    }

    const scan = await Scan.create({
      targetUrl,
      status:    'running',
      startedAt: new Date(),
      userId:    req.user?.id || null
    });

    // Respond immediately — scan runs async
    res.status(201).json({
      success: true,
      message: 'Scan started',
      data: { _id: scan._id, targetUrl: scan.targetUrl, status: scan.status, createdAt: scan.createdAt }
    });

    // ── Async pipeline ────────────────────────────────────────────────────────
    (async () => {
      try {
        const sid = scan._id.toString();
        emitProgress(sid, 1, 'Validating URL', 10);
        emitProgress(sid, 2, 'Fetching target', 20);
        const { findings, metadata } = await runScan(targetUrl, (step, label, pct) =>
          emitProgress(sid, step, label, pct)
        );
        emitProgress(sid, 6, 'Calculating risk score', 90);
        const riskScore  = calculateRiskScore(findings);
        const vulnCounts = getSeverityCounts(findings);

        scan.findings    = findings;
        scan.riskScore   = riskScore;
        scan.vulnCounts  = vulnCounts;
        scan.metadata    = metadata;
        scan.status      = 'completed';
        scan.completedAt = new Date();
        await scan.save();
        emitProgress(sid, 6, 'Scan complete', 100);
        progressStore.delete(sid);
        progressClients.get(sid)?.forEach((r) => r.end());
        progressClients.delete(sid);

        // Generate PDF (non-blocking)
        try {
          const reportPath = await generateReport(scan);
          scan.reportPath  = reportPath;
          await scan.save();
        } catch (pdfErr) {
          logger.error(`PDF generation failed for scan ${scan._id}: ${pdfErr.message}`);
        }

        // Dispatch alerts for high/critical findings
        try {
          const user = scan.userId ? await User.findById(scan.userId) : null;
          await dispatchAlerts(user, scan);
        } catch (alertErr) {
          logger.error(`Alert dispatch failed: ${alertErr.message}`);
        }

        logger.info(`Scan ${scan._id} completed. Score: ${riskScore}, Findings: ${findings.length}`);
      } catch (scanErr) {
        console.log('Backend: Scan pipeline error:', scanErr.message);
        scan.status       = 'failed';
        scan.errorMessage = scanErr.message;
        scan.completedAt  = new Date();
        await scan.save();
      }
    })();
  } catch (error) {
    console.log('Backend: Error in createScan:', error.message);
    next(error);
  }
};

// ─── GET /api/scans ───────────────────────────────────────────────────────────
const getScans = async (req, res, next) => {
  try {
    const filter = req.user?.id ? { userId: req.user.id } : {};
    const scans  = await Scan.find(filter)
      .select('targetUrl status riskScore vulnCounts createdAt completedAt startedAt')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ success: true, data: scans, scans });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/scans/:id ───────────────────────────────────────────────────────
const getScan = async (req, res, next) => {
  try {
    const scan = await Scan.findById(req.params.id);
    if (!scan) return res.status(404).json({ success: false, message: 'Scan not found' });

    // Pull structured fields out of metadata so the frontend has a flat shape
    const meta = scan.metadata || {};
    const enriched = {
      ...scan.toObject(),
      headers:      meta.headers      || {},
      technologies: meta.technologies || [],
      tlsInfo:      meta.tlsInfo      || null,
      ports:        meta.ports        || { open: [], risky: [] }
    };

    res.json({ success: true, data: enriched, scan: enriched });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/scans/dashboard ─────────────────────────────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const userFilter = req.user?.id ? { userId: req.user.id } : {};

    const [totalScans, completedScans, failedScans, recentScans, scoreAgg] = await Promise.all([
      Scan.countDocuments(userFilter),
      Scan.countDocuments({ ...userFilter, status: 'completed' }),
      Scan.countDocuments({ ...userFilter, status: 'failed' }),
      Scan.find(userFilter)
        .select('targetUrl status riskScore vulnCounts createdAt completedAt')
        .sort({ createdAt: -1 })
        .limit(5),
      Scan.aggregate([
        { $match: { ...userFilter, riskScore: { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$riskScore' }, min: { $min: '$riskScore' } } }
      ])
    ]);

    // Aggregate high/critical counts from stored vulnCounts (no $unwind needed)
    const vulnAgg = await Scan.aggregate([
      { $match: { ...userFilter, status: 'completed' } },
      {
        $group: {
          _id:      null,
          critical: { $sum: '$vulnCounts.critical' },
          high:     { $sum: '$vulnCounts.high' },
          medium:   { $sum: '$vulnCounts.medium' },
          low:      { $sum: '$vulnCounts.low' }
        }
      }
    ]);

    // Category breakdown across all completed scans
    const categoryAgg = await Scan.aggregate([
      { $match: { ...userFilter, status: 'completed' } },
      { $unwind: '$findings' },
      { $group: { _id: '$findings.category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Scans over time — last 30 days grouped by date
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const scansOverTime = await Scan.aggregate([
      { $match: { ...userFilter, createdAt: { $gte: thirtyDaysAgo } } },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);

    // Most vulnerable targets — top 5 by total vuln count
    const mostVulnerable = await Scan.aggregate([
      { $match: { ...userFilter, status: 'completed' } },
      { $group: {
        _id: '$targetUrl',
        latestScore: { $last: '$riskScore' },
        totalFindings: { $sum: '$vulnCounts.total' },
        scanCount: { $sum: 1 }
      }},
      { $sort: { totalFindings: -1 } },
      { $limit: 5 }
    ]);

    const vulns = vulnAgg[0] || { critical: 0, high: 0, medium: 0, low: 0 };

    res.json({
      success: true,
      data: {
        totalScans,
        completedScans,
        failedScans,
        highVulnerabilities:  (vulns.critical || 0) + (vulns.high || 0),
        vulnBreakdown: {
          critical: vulns.critical || 0,
          high:     vulns.high     || 0,
          medium:   vulns.medium   || 0,
          low:      vulns.low      || 0
        },
        averageRiskScore: scoreAgg[0] ? Math.round(scoreAgg[0].avg) : null,
        lowestRiskScore:  scoreAgg[0] ? scoreAgg[0].min : null,
        categoryBreakdown: categoryAgg.map((c) => ({ category: c._id || 'Other', count: c.count })),
        scansOverTime: scansOverTime.map((d) => ({ date: d._id, count: d.count })),
        mostVulnerable: mostVulnerable.map((t) => ({
          targetUrl: t._id,
          latestScore: t.latestScore,
          totalFindings: t.totalFindings,
          scanCount: t.scanCount
        })),
        recentScans
      }
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/scans/:id/progress  (SSE) ──────────────────────────────────────
const getScanProgress = (req, res) => {
  const { id } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state immediately
  const current = progressStore.get(id);
  if (current) res.write(`data: ${JSON.stringify(current)}\n\n`);

  if (!progressClients.has(id)) progressClients.set(id, new Set());
  progressClients.get(id).add(res);

  req.on('close', () => {
    progressClients.get(id)?.delete(res);
  });
};

function emitProgress(scanId, step, label, pct) {
  const payload = { step, label, pct };
  progressStore.set(scanId, payload);
  progressClients.get(scanId)?.forEach((res) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  });
}

// ─── GET /api/scans/compare?a=id1&b=id2 ──────────────────────────────────────
const compareScan = async (req, res, next) => {
  try {
    const { a, b } = req.query;
    if (!a || !b) return res.status(400).json({ success: false, message: 'Provide ?a=scanId&b=scanId' });

    const [scanA, scanB] = await Promise.all([
      Scan.findById(a),
      Scan.findById(b)
    ]);
    if (!scanA || !scanB) return res.status(404).json({ success: false, message: 'One or both scans not found' });

    const findingsA = new Map((scanA.findings || []).map((f) => [f.name, f]));
    const findingsB = new Map((scanB.findings || []).map((f) => [f.name, f]));

    const allNames = new Set([...findingsA.keys(), ...findingsB.keys()]);
    const diff = [];
    for (const name of allNames) {
      const inA = findingsA.has(name);
      const inB = findingsB.has(name);
      diff.push({
        name,
        finding: findingsA.get(name) || findingsB.get(name),
        status: inA && inB ? 'persists' : inA ? 'resolved' : 'new'
      });
    }

    res.json({
      success: true,
      data: {
        scanA: { _id: scanA._id, targetUrl: scanA.targetUrl, riskScore: scanA.riskScore, createdAt: scanA.createdAt, vulnCounts: scanA.vulnCounts },
        scanB: { _id: scanB._id, targetUrl: scanB.targetUrl, riskScore: scanB.riskScore, createdAt: scanB.createdAt, vulnCounts: scanB.vulnCounts },
        scoreDelta: (scanB.riskScore ?? 0) - (scanA.riskScore ?? 0),
        diff: diff.sort((x, y) => {
          const o = { new: 0, persists: 1, resolved: 2 };
          return (o[x.status] ?? 3) - (o[y.status] ?? 3);
        })
      }
    });
  } catch (err) { next(err); }
};

module.exports = { createScan, getScans, getScan, getDashboardStats, getScanProgress, compareScan, emitProgress };
