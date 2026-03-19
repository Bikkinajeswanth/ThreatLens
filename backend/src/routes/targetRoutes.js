const express = require('express');
const router  = express.Router();
const { getTargets, createTarget, updateTarget, deleteTarget } = require('../controllers/targetController');

router.get('/',     getTargets);
router.post('/',    createTarget);
router.put('/:id',  updateTarget);
router.delete('/:id', deleteTarget);

module.exports = router;
