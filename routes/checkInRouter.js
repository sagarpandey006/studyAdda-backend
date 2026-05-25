const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
  getAllCheckIns,
  checkInStudent,
  checkOutStudent,
  checkOutByRFID,
  getStudentCheckInHistory,
  tapRFID
} = require('../controllers/checkInController');

// All routes require authentication
// router.use(isAuthenticated);

// GET all check-in records (admin only) - ?status=checked-in&date=today
router.get('/', getAllCheckIns);

// POST check in via RFID - body: { rfidCard }
router.post('/checkin', checkInStudent);

// POST check out via RFID - body: { rfidCard }
router.post('/checkout-rfid', checkOutByRFID);

// POST check out by record ID
router.post('/checkout/:checkInId', checkOutStudent);

// GET student's check-in history
router.get('/student/:studentId', getStudentCheckInHistory);

// POST checkin/checkout by tap
router.post('/tap', tapRFID);

module.exports = router;
