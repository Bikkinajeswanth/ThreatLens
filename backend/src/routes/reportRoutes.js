const express = require('express');
const router = express.Router();
const { getReports, downloadReport } = require('../controllers/reportController');

router.get('/', getReports);
router.get('/:scanId/download', downloadReport);

module.exports = router;
