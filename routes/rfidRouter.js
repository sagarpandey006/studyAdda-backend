const express = require('express');
const router = express.Router();

const { scanRFID } = require('../controllers/rfidSessionController');

// RFID scan API
router.post('/scan', scanRFID);

module.exports = router;