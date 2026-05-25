const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const seatController = require('../controllers/seatController');

// Public stats (can be shown on login page if needed)
router.get('/statistics', seatController.getSeatStatistics);

// All other routes require authentication
// router.use(isAuthenticated);

router.get('/', seatController.getAllSeats);
router.get('/my-booking', seatController.getCurrentBooking);
router.get('/my-bookings', seatController.getUserBookings);
router.get('/:id', seatController.getSeatById);

// Member can book/release their own seat
router.post('/:seatId/book', seatController.bookSeat);
router.post('/:seatId/release', seatController.releaseSeat);

// Admin-only seat management
router.post('/initialize', seatController.initializeSeats);
router.post('/', seatController.createSeat);
router.patch('/:seatId/status', seatController.updateSeatStatus);
router.delete('/:id', seatController.deleteSeat);
router.post('/admin-book', seatController.adminBookSeat);

module.exports = router;
