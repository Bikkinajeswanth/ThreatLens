const Target = require('../models/Target');
const { validateTargetUrl } = require('../scanners/utils/urlValidator');

// GET /api/targets
const getTargets = async (req, res, next) => {
  try {
    const targets = await Target.find({ userId: req.user.id })
      .sort({ createdAt: -1 });
    res.json({ success: true, data: targets });
  } catch (err) { next(err); }
};

// POST /api/targets
const createTarget = async (req, res, next) => {
  try {
    const { name, url, description, tags, schedule, alerts } = req.body;
    if (!name || !url) {
      return res.status(400).json({ success: false, message: 'name and url are required' });
    }

    let validatedUrl;
    try { validatedUrl = await validateTargetUrl(url); }
    catch (e) { return res.status(400).json({ success: false, message: e.message }); }

    // Compute first nextRunAt if scheduling is enabled
    let nextRunAt = null;
    if (schedule?.enabled && schedule?.frequency) {
      nextRunAt = computeNextRun(schedule.frequency);
    }

    const target = await Target.create({
      userId: req.user.id,
      name,
      url: validatedUrl,
      description: description || '',
      tags: tags || [],
      schedule: { ...schedule, nextRunAt },
      alerts
    });

    res.status(201).json({ success: true, data: target });
  } catch (err) { next(err); }
};

// PUT /api/targets/:id
const updateTarget = async (req, res, next) => {
  try {
    const target = await Target.findOne({ _id: req.params.id, userId: req.user.id });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });

    const { name, url, description, tags, schedule, alerts } = req.body;

    if (url && url !== target.url) {
      try { req.body.url = await validateTargetUrl(url); }
      catch (e) { return res.status(400).json({ success: false, message: e.message }); }
    }

    if (schedule?.enabled && schedule?.frequency !== target.schedule?.frequency) {
      schedule.nextRunAt = computeNextRun(schedule.frequency);
    }

    Object.assign(target, { name, url: req.body.url || target.url, description, tags, schedule, alerts });
    await target.save();

    res.json({ success: true, data: target });
  } catch (err) { next(err); }
};

// DELETE /api/targets/:id
const deleteTarget = async (req, res, next) => {
  try {
    const target = await Target.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!target) return res.status(404).json({ success: false, message: 'Target not found' });
    res.json({ success: true, message: 'Target deleted' });
  } catch (err) { next(err); }
};

function computeNextRun(frequency) {
  const d = new Date();
  if (frequency === 'daily')   d.setDate(d.getDate() + 1);
  if (frequency === 'weekly')  d.setDate(d.getDate() + 7);
  if (frequency === 'monthly') d.setMonth(d.getMonth() + 1);
  return d;
}

module.exports = { getTargets, createTarget, updateTarget, deleteTarget };
