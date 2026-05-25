const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const { getDashboardStats } = require('../controllers/dashboardController');

// GET /api/dashboard/stats
router.get('/stats', getDashboardStats);

module.exports = router;
