const express = require('express');
const router = express.Router();
const {
  createScan, getScans, getScan,
  getDashboardStats, getScanProgress, compareScan
} = require('../controllers/scanController');

router.post('/',              createScan);
router.get('/',               getScans);
router.get('/dashboard',      getDashboardStats);   // must be before /:id
router.get('/compare',        compareScan);          // must be before /:id
router.get('/:id/progress',   getScanProgress);
router.get('/:id',            getScan);

module.exports = router;
