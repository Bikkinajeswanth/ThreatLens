const mongoose = require('mongoose');

const findingSchema = new mongoose.Schema({
  type:           { type: String },
  name:           { type: String, required: true },
  severity:       { type: String, enum: ['critical', 'high', 'medium', 'low', 'info'], default: 'low' },
  category:       { type: String, enum: ['Configuration', 'Network', 'Information Disclosure', 'Injection', 'Authentication', 'TLS', 'API', 'Other'], default: 'Other' },
  description:    { type: String },
  recommendation: { type: String },
  port:           { type: Number },
  owaspCategory:  { type: String, default: null },   // e.g. "A05:2021"
  owaspName:      { type: String, default: null },   // e.g. "Security Misconfiguration"
  aiExplanation:  { type: String, default: null }    // generated plain-English explanation
}, { _id: false });

// One data-point in the score history timeline
const scoreSnapshotSchema = new mongoose.Schema({
  score:     { type: Number, required: true },
  scannedAt: { type: Date,   required: true }
}, { _id: false });

const scanSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  targetUrl: { type: String, required: true, trim: true },
  status:    { type: String, enum: ['pending', 'running', 'completed', 'failed'], default: 'pending' },

  findings:   { type: [findingSchema], default: [] },
  riskScore:  { type: Number, min: 0, max: 100, default: null },

  vulnCounts: {
    critical: { type: Number, default: 0 },
    high:     { type: Number, default: 0 },
    medium:   { type: Number, default: 0 },
    low:      { type: Number, default: 0 },
    total:    { type: Number, default: 0 }
  },

  // Attack-surface extras
  subdomains:   { type: [String], default: [] },
  apiEndpoints: { type: [mongoose.Schema.Types.Mixed], default: [] },

  // Score history (copied from previous scans of same host at save time)
  scoreHistory: { type: [scoreSnapshotSchema], default: [] },

  // Whether this scan was triggered by the scheduler or a replay
  triggerType: { type: String, enum: ['manual', 'scheduled', 'replay'], default: 'manual' },
  parentScanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Scan', default: null },

  metadata:     { type: mongoose.Schema.Types.Mixed, default: {} },
  reportPath:   { type: String, default: null },
  errorMessage: { type: String, default: null },
  startedAt:    { type: Date, default: null },
  completedAt:  { type: Date, default: null }
}, { timestamps: true });

scanSchema.index({ userId: 1, createdAt: -1 });
scanSchema.index({ targetUrl: 1, status: 1 });

module.exports = mongoose.model('Scan', scanSchema);
