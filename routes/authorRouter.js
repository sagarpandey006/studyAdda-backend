const express = require('express');
const router = express.Router();
const { isAdmin } = require('../middleware/auth');
const {
  getAuthor,
  getAllAuthors,
  addAuthor,
  updateAuthor,
  deleteAuthor
} = require('../controllers/authorController');

// Members can read authors (for book browsing)
router.get('/getAll', getAllAuthors);
router.get('/get/:id', getAuthor);

// Admin-only
router.post('/add', addAuthor);
router.put('/update/:id', updateAuthor);
router.delete('/delete/:id', deleteAuthor);

module.exports = router;
