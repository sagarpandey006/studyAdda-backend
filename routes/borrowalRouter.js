const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
  getBorrowal,
  getAllBorrowals,
  addBorrowal,
  returnBorrowal,
  updateBorrowal,
  deleteBorrowal,
  getBorrowalsByStudent,
  getIssuedBooksByStudent,
  searchAvailableBooks
} = require('../controllers/borrowalController');

// router.use(isAuthenticated);

// Search available books (for issue dialog) - must be before /:id routes
router.get('/available-books', searchAvailableBooks);

// Student borrowal history
router.get('/student/:studentId/history', getBorrowalsByStudent);

// Currently issued books for a student
router.get('/student/:studentId/issued', getIssuedBooksByStudent);

// Admin CRUD
router.get('/getAll', getAllBorrowals);
router.get('/get/:id', getBorrowal);
router.post('/add', addBorrowal);
router.post('/return/:id', returnBorrowal);
router.put('/update/:id', updateBorrowal);
router.delete('/delete/:id', deleteBorrowal);

module.exports = router;
