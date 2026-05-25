const express = require('express');
const router = express.Router();
const upload = require("../middleware/upload");
const { isAdmin } = require('../middleware/auth');
const {
  getBook,
  getAllBooks,
  addBook,
  updateBook,
  deleteBook
} = require('../controllers/bookController');

// Public read access (members can also browse books)
router.get('/getAll', getAllBooks);
router.get('/get/:id', getBook);

// Admin-only write access
router.post('/add', upload.single("image"), addBook);
router.put('/update/:id', upload.single("image"), updateBook);
router.delete('/delete/:id', deleteBook);

module.exports = router;
