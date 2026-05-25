const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const {
  getUser,
  getAllUsers,
  getAllMembers,
  addUser,
  updateUser,
  deleteUser,
  blockStudent,
  unblockStudent,
  getStudentByScholarNumber,
  getStudentByEnrollmentNumber,
  getStudentByRFID,
  getMyProfile
} = require('../controllers/userController');

// router.use(isAuthenticated);

// Profile route for logged-in user
router.get('/me', getMyProfile);

// Admin-only routes
router.get('/getAll', getAllUsers);
router.get('/getAllMembers', getAllMembers);
router.get('/get/:id', getUser);
router.post('/add', addUser);
router.put('/update/:id', updateUser);
router.delete('/delete/:id', deleteUser);

// Student management
router.patch('/:id/block', blockStudent);
router.patch('/:id/unblock', unblockStudent);

// Student search
router.get('/search/scholar/:scholarNumber', getStudentByScholarNumber);
router.get('/search/enrollment/:enrollmentNumber', getStudentByEnrollmentNumber);
router.get('/search/rfid/:rfidCard', getStudentByRFID);

module.exports = router;
