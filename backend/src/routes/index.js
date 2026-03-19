const express = require('express');
const router  = express.Router();

const authRoutes    = require('./authRoutes');
const scanRoutes    = require('./scanRoutes');
const reportRoutes  = require('./reportRoutes');
const userRoutes    = require('./userRoutes');
const targetRoutes  = require('./targetRoutes');
const authMiddleware = require('../middleware/authMiddleware');

// Optional auth — attaches req.user if token present, never blocks
const optionalAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const decoded = require('jsonwebtoken').verify(
      authHeader.substring(7), process.env.JWT_SECRET
    );
    req.user = { id: decoded.id };
  } catch { /* invalid token — continue without user */ }
  next();
};

router.use('/auth',    authRoutes);
router.use('/scans',   optionalAuth, scanRoutes);
router.use('/reports', optionalAuth, reportRoutes);
router.use('/users',   authMiddleware, userRoutes);
router.use('/targets', authMiddleware, targetRoutes);

router.get('/ping', (req, res) => res.json({ message: 'API routing works' }));

module.exports = router;
