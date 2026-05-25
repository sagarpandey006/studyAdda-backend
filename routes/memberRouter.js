const express = require('express');
const router = express.Router();
const { isAuthenticated, isMember } = require('../middleware/auth');
const {
  getMemberDashboard,
  getMyBorrowals,
  getMyIssuedBooks,
  getMyCheckIns,
  getMyCurrentCheckIn,
  getMyPayments,
  getMyFines,
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getMySeat,
  getMySeatHistory,
  renewMyBorrowal
} = require('../controllers/memberController');

// All member routes require login + non-admin check
router.use(isAuthenticated, isMember);

// Dashboard
router.get('/dashboard', getMemberDashboard);

// Borrowals / Books issued
router.get('/my-borrowals', getMyBorrowals);        // full history, ?status=issued|returned|overdue
router.get('/my-issued-books', getMyIssuedBooks);   // only active issued/overdue
router.post('/renew/:borrowalId', renewMyBorrowal); // renew a book (+15 days, max 3 times)

// Check-in / Check-out
router.get('/my-checkins', getMyCheckIns);           // history, ?page=1&limit=20
router.get('/my-current-checkin', getMyCurrentCheckIn); // am I currently checked in?

// Payments & Fines
router.get('/my-payments', getMyPayments);           // payment history
router.get('/my-fines', getMyFines);                 // pending fines breakdown

// Seat
router.get('/my-seat', getMySeat);                   // current active seat booking
router.get('/my-seat-history', getMySeatHistory);    // past bookings

// Profile
router.get('/profile', getMyProfile);
router.put('/profile', updateMyProfile);             // update name, phone, address, photo, dob
router.put('/change-password', changeMyPassword);

module.exports = router;
