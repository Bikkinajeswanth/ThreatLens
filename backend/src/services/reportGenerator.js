const PDFDocument = require('pdfkit');
const fs   = require('fs');
const path = require('path');
const { getRiskLabel, getRiskColor, getSeverityCounts, getCategoryCounts } = require('./riskScore');
const logger = require('../utils/logger');

const REPORTS_DIR = path.join(__dirname, '../../storage/reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

// ─── PALETTE ──────────────────────────────────────────────────────────────────
const C = {
  primary:   '#1e40af',
  dark:      '#1e293b',
  muted:     '#64748b',
  white:     '#ffffff',
  critical:  '#dc2626',
  high:      '#ea580c',
  medium:    '#d97706',
  low:       '#2563eb',
  info:      '#6b7280',
  green:     '#16a34a',
  lightGray: '#f1f5f9',
  border:    '#cbd5e1'
};

const SEV_COLOR = { critical: C.critical, high: C.high, medium: C.medium, low: C.low, info: C.info };

const RISK_COLOR_MAP = { green: C.green, yellow: C.medium, orange: C.high, red: C.critical };

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function fillRect(doc, x, y, w, h, color) {
  doc.save().rect(x, y, w, h).fill(color).restore();
}

function hline(doc, x, y, w, color = C.border) {
  doc.save().moveTo(x, y).lineTo(x + w, y).strokeColor(color).lineWidth(0.5).stroke().restore();
}

function sectionHeader(doc, title, margin, pageW) {
  // Ensure we have room; add page if within 80 px of bottom
  if (doc.y > doc.page.height - 100) doc.addPage();
  doc.moveDown(0.8);
  doc.fillColor(C.primary).fontSize(14).font('Helvetica-Bold').text(title, margin);
  hline(doc, margin, doc.y + 2, pageW);
  doc.moveDown(0.6);
}

function severityPill(doc, severity, x, y) {
  const color = SEV_COLOR[(severity || 'info').toLowerCase()] || C.info;
  fillRect(doc, x, y, 58, 14, color);
  doc.fillColor(C.white).fontSize(7).font('Helvetica-Bold')
     .text((severity || 'info').toUpperCase(), x, y + 3, { width: 58, align: 'center' });
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function generateReport(scan) {
  const filename = `report-${scan._id}.pdf`;
  const filePath = path.join(REPORTS_DIR, filename);

  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    const margin = 50;
    const pageW  = doc.page.width - margin * 2;   // 495 pt on A4

    const findings     = scan.findings || [];
    const score        = scan.riskScore ?? 0;
    const riskLabel    = getRiskLabel(score);
    const riskColorKey = getRiskColor(score);
    const scoreColor   = RISK_COLOR_MAP[riskColorKey] || C.muted;
    const sevCounts    = getSeverityCounts(findings);
    const catCounts    = getCategoryCounts(findings);

    // ── COVER BANNER ────────────────────────────────────────────────────────────
    fillRect(doc, 0, 0, doc.page.width, 100, C.primary);

    doc.fillColor(C.white).fontSize(26).font('Helvetica-Bold').text('ThreatLens', margin, 22);
    doc.fontSize(12).font('Helvetica').text('Security Vulnerability Assessment Report', margin, 54);
    doc.fontSize(9).text(`Generated: ${new Date().toUTCString()}`, margin, 72);

    doc.y = 115;

    // ── SECTION 1: EXECUTIVE SUMMARY ────────────────────────────────────────────
    sectionHeader(doc, '1. Executive Summary', margin, pageW);

    const execLines = [
      `This report presents the results of an automated security assessment performed against ${scan.targetUrl}.`,
      `The scan identified ${findings.length} finding${findings.length !== 1 ? 's' : ''} across ${Object.keys(catCounts).length} categor${Object.keys(catCounts).length !== 1 ? 'ies' : 'y'}.`,
      `The overall security score is ${score}/100 — rated "${riskLabel}".`,
      sevCounts.critical > 0 || sevCounts.high > 0
        ? `Immediate attention is required for ${sevCounts.critical} critical and ${sevCounts.high} high severity findings.`
        : 'No critical or high severity findings were detected.'
    ];

    doc.fillColor(C.dark).fontSize(10).font('Helvetica');
    for (const line of execLines) {
      doc.text(line, margin, doc.y, { width: pageW });
      doc.moveDown(0.4);
    }

    // Scan metadata table
    doc.moveDown(0.4);
    const metaRows = [
      ['Target URL',   scan.targetUrl],
      ['Scan ID',      scan._id.toString()],
      ['Status',       scan.status.toUpperCase()],
      ['Started',      new Date(scan.createdAt).toUTCString()],
      ['Completed',    scan.completedAt ? new Date(scan.completedAt).toUTCString() : 'N/A'],
      ['Technologies', (scan.metadata?.detectedTech || []).map((t) => (typeof t === 'object' ? t.name : t)).join(', ') || 'Not detected'],
      ['Open Ports',   (scan.metadata?.openPorts || []).join(', ') || 'None detected']
    ];

    for (let i = 0; i < metaRows.length; i++) {
      const [label, value] = metaRows[i];
      const rowY = doc.y;
      if (i % 2 === 0) fillRect(doc, margin - 2, rowY - 1, pageW + 4, 18, C.lightGray);
      doc.fillColor(C.muted).fontSize(9).font('Helvetica-Bold').text(label, margin, rowY, { width: 140, continued: false });
      doc.fillColor(C.dark).fontSize(9).font('Helvetica').text(String(value), margin + 150, rowY, { width: pageW - 150 });
      doc.y = rowY + 18;
    }

    // ── SECTION 2: SECURITY SCORE ────────────────────────────────────────────────
    sectionHeader(doc, '2. Security Score', margin, pageW);

    // Score block
    const scoreBlockY = doc.y;
    fillRect(doc, margin, scoreBlockY, 90, 70, scoreColor);
    doc.fillColor(C.white).fontSize(32).font('Helvetica-Bold')
       .text(String(score), margin, scoreBlockY + 12, { width: 90, align: 'center' });
    doc.fontSize(9).font('Helvetica')
       .text('/ 100', margin, scoreBlockY + 48, { width: 90, align: 'center' });

    doc.fillColor(C.dark).fontSize(18).font('Helvetica-Bold')
       .text(riskLabel, margin + 105, scoreBlockY + 10);
    doc.fillColor(C.muted).fontSize(10).font('Helvetica')
       .text(`Based on ${findings.length} finding${findings.length !== 1 ? 's' : ''}`, margin + 105, scoreBlockY + 36);

    doc.y = scoreBlockY + 80;
    doc.moveDown(0.5);

    // Severity breakdown pills row
    const pillLabels = ['critical', 'high', 'medium', 'low'];
    const pillW = Math.floor(pageW / 4) - 6;
    const pillY = doc.y;
    pillLabels.forEach((sev, i) => {
      const px = margin + i * (pillW + 8);
      fillRect(doc, px, pillY, pillW, 36, SEV_COLOR[sev]);
      doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
         .text(sev.toUpperCase(), px, pillY + 4, { width: pillW, align: 'center' });
      doc.fontSize(14).font('Helvetica-Bold')
         .text(String(sevCounts[sev]), px, pillY + 16, { width: pillW, align: 'center' });
    });
    doc.y = pillY + 46;

    // Category breakdown table
    if (Object.keys(catCounts).length > 0) {
      doc.moveDown(0.8);
      doc.fillColor(C.dark).fontSize(10).font('Helvetica-Bold').text('Findings by Category', margin);
      doc.moveDown(0.3);

      const catEntries = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
      const colW = [pageW * 0.55, pageW * 0.2, pageW * 0.25];

      // Header row
      fillRect(doc, margin - 2, doc.y - 1, pageW + 4, 18, C.dark);
      doc.fillColor(C.white).fontSize(8).font('Helvetica-Bold');
      doc.text('Category',  margin,                doc.y - 16, { width: colW[0] });
      doc.text('Count',     margin + colW[0],       doc.y - 16, { width: colW[1], align: 'center' });
      doc.text('% of Total',margin + colW[0] + colW[1], doc.y - 16, { width: colW[2], align: 'center' });
      doc.y += 4;

      catEntries.forEach(([cat, count], i) => {
        const rowY = doc.y;
        if (i % 2 === 0) fillRect(doc, margin - 2, rowY - 1, pageW + 4, 16, C.lightGray);
        const pct = findings.length > 0 ? ((count / findings.length) * 100).toFixed(1) : '0.0';
        doc.fillColor(C.dark).fontSize(9).font('Helvetica');
        doc.text(cat,          margin,                rowY, { width: colW[0] });
        doc.text(String(count),margin + colW[0],       rowY, { width: colW[1], align: 'center' });
        doc.text(`${pct}%`,    margin + colW[0] + colW[1], rowY, { width: colW[2], align: 'center' });
        doc.y = rowY + 16;
      });
    }

    // ── SECTION 3: DETAILED FINDINGS ────────────────────────────────────────────
    sectionHeader(doc, '3. Detailed Findings', margin, pageW);

    if (findings.length === 0) {
      doc.fillColor(C.green).fontSize(11).font('Helvetica')
         .text('No vulnerabilities were detected during this scan.', margin);
    } else {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const sorted = [...findings].sort(
        (a, b) => (severityOrder[a.severity] ?? 5) - (severityOrder[b.severity] ?? 5)
      );

      sorted.forEach((finding, idx) => {
        if (doc.y > doc.page.height - 140) { doc.addPage(); }

        const startY = doc.y;

        // Left accent bar
        fillRect(doc, margin - 2, startY, 4, 14, SEV_COLOR[(finding.severity || 'info').toLowerCase()] || C.muted);

        // Index + name
        doc.fillColor(C.dark).fontSize(10).font('Helvetica-Bold')
           .text(`${idx + 1}. ${finding.name}`, margin + 8, startY, { width: pageW - 70 });

        // Severity pill (top-right)
        severityPill(doc, finding.severity, margin + pageW - 60, startY);

        doc.y = startY + 16;

        // Category tag
        doc.fillColor(C.muted).fontSize(8).font('Helvetica')
           .text(`Category: ${finding.category || 'Other'}`, margin + 8, doc.y);
        doc.moveDown(0.3);

        // Description
        doc.fillColor(C.dark).fontSize(9).font('Helvetica')
           .text(finding.description || '', margin + 8, doc.y, { width: pageW - 10 });
        doc.moveDown(0.3);

        // Recommendation
        if (finding.recommendation) {
          doc.fillColor(C.primary).fontSize(9).font('Helvetica-Bold')
             .text('Recommendation: ', margin + 8, doc.y, { continued: true });
          doc.fillColor(C.dark).font('Helvetica')
             .text(finding.recommendation, { width: pageW - 80 });
        }

        if (finding.port) {
          doc.fillColor(C.muted).fontSize(8).font('Helvetica')
             .text(`Port: ${finding.port}`, margin + 8, doc.y);
        }

        doc.moveDown(0.5);
        hline(doc, margin, doc.y, pageW);
        doc.moveDown(0.4);
      });
    }

    // ── SECTION 4: RECOMMENDATIONS ──────────────────────────────────────────────
    sectionHeader(doc, '4. Key Recommendations', margin, pageW);

    const highPriority = findings.filter((f) =>
      ['critical', 'high'].includes((f.severity || '').toLowerCase())
    );

    if (highPriority.length === 0) {
      doc.fillColor(C.green).fontSize(10).font('Helvetica')
         .text('No critical or high-priority recommendations at this time.', margin);
    } else {
      highPriority.slice(0, 10).forEach((f, i) => {
        if (doc.y > doc.page.height - 90) { doc.addPage(); }

        const numY = doc.y;
        fillRect(doc, margin, numY, 20, 20, SEV_COLOR[(f.severity || 'high').toLowerCase()]);
        doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
           .text(String(i + 1), margin, numY + 5, { width: 20, align: 'center' });

        doc.fillColor(C.dark).fontSize(10).font('Helvetica-Bold')
           .text(f.name, margin + 26, numY, { width: pageW - 26 });
        doc.y = numY + 22;

        doc.fillColor(C.muted).fontSize(9).font('Helvetica')
           .text(f.recommendation || '', margin + 26, doc.y, { width: pageW - 26 });
        doc.moveDown(0.6);
      });
    }

    // ── FOOTER on every page ─────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      const footerY = doc.page.height - 35;
      hline(doc, margin, footerY, pageW);
      doc.fillColor(C.muted).fontSize(8).font('Helvetica')
         .text(
           `ThreatLens Security Platform — Confidential   |   Page ${i + 1} of ${range.count}`,
           margin, footerY + 8,
           { width: pageW, align: 'center' }
         );
    }

    doc.end();

    stream.on('finish', () => {
      logger.info(`Report saved: ${filePath}`);
      resolve(filePath);
    });
    stream.on('error', (err) => {
      logger.error(`Report write error: ${err.message}`);
      reject(err);
    });
  });
}

module.exports = { generateReport, REPORTS_DIR };
