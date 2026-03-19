const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  action:    { type: String, required: true },
  resource:  { type: String, default: null },
  resourceId:{ type: mongoose.Schema.Types.ObjectId, default: null },
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
  metadata:  { type: mongoose.Schema.Types.Mixed, default: {} },
  severity:  { type: String, enum: ['info', 'warning', 'critical'], default: 'info' }
}, { timestamps: true });

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
