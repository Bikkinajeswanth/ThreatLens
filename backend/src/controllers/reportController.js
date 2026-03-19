const fs = require('fs');
const path = require('path');
const Scan = require('../models/Scan');
const { generateReport, REPORTS_DIR } = require('../services/reportGenerator');
const logger = require('../utils/logger');

// GET /api/reports — list all completed scans that have reports
const getReports = async (req, res, next) => {
  try {
    const filter = req.user?.id
      ? { userId: req.user.id, status: 'completed' }
      : { status: 'completed' };

    const scans = await Scan.find(filter)
      .select('targetUrl status riskScore createdAt completedAt reportPath findings')
      .sort({ createdAt: -1 });

    const reports = scans.map((scan) => {
      const filename = `report-${scan._id}.pdf`;
      const filePath = path.join(REPORTS_DIR, filename);
      const fileExists = fs.existsSync(filePath);
      let size = null;
      if (fileExists) {
        const stat = fs.statSync(filePath);
        size = `${(stat.size / 1024).toFixed(1)} KB`;
      }

      return {
        _id: scan._id,
        scanId: scan._id,
        url: scan.targetUrl,
        targetUrl: scan.targetUrl,
        riskScore: scan.riskScore,
        findingsCount: scan.findings?.length || 0,
        createdAt: scan.createdAt,
        completedAt: scan.completedAt,
        filename,
        size,
        hasReport: fileExists
      };
    });

    res.json({ success: true, data: reports, reports });
  } catch (error) {
    next(error);
  }
};

// GET /api/reports/:scanId/download — stream PDF to client
const downloadReport = async (req, res, next) => {
  try {
    const scan = await Scan.findById(req.params.scanId);

    if (!scan) {
      return res.status(404).json({ success: false, message: 'Scan not found' });
    }

    if (scan.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Scan is not yet completed' });
    }

    const filename = `report-${scan._id}.pdf`;
    const filePath = path.join(REPORTS_DIR, filename);

    // Generate on-demand if file doesn't exist yet
    if (!fs.existsSync(filePath)) {
      logger.info(`Generating report on-demand for scan ${scan._id}`);
      await generateReport(scan);
    }

    if (!fs.existsSync(filePath)) {
      return res.status(500).json({ success: false, message: 'Report generation failed' });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        logger.error(`Report download error for ${scan._id}: ${err.message}`);
        if (!res.headersSent) {
          next(err);
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getReports, downloadReport };
