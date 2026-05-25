const Borrowal = require('../models/borrowal');
const Book = require('../models/book');
const User = require('../models/user');

// Get single borrowal by ID
const getBorrowal = async (req, res) => {
  try {
    const borrowal = await Borrowal.findById(req.params.id)
      .populate('bookId', 'name isbn photoUrl')
      .populate('memberId', 'name email scholarNumber enrollmentNumber');

    if (!borrowal) {
      return res.status(404).json({ success: false, message: 'Borrowal not found' });
    }
    return res.status(200).json({ success: true, borrowal });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get all borrowals (with joined user and book data)
const getAllBorrowals = async (req, res) => {
  try {
    const borrowals = await Borrowal.find()
      .populate('bookId', 'name isbn photoUrl availableCopies totalCopies')
      .populate('memberId', 'name email scholarNumber enrollmentNumber photoUrl')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 });

    // Auto-mark overdue records
    const today = new Date();
    const formatted = borrowals.map(b => {
      const obj = b.toObject();
      if (obj.status === 'issued' && obj.dueDate && new Date(obj.dueDate) < today) {
        obj.status = 'overdue';
        // Calculate fine: Rs.5 per day overdue
        const diffMs = today - new Date(obj.dueDate);
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        obj.lateDays = diffDays;
        obj.fine = diffDays * 5;
      } else {
        obj.lateDays = 0;
      }
      // Rename for frontend compatibility
      obj.user = obj.memberId;
      obj.book = obj.bookId;
      return obj;
    });

    return res.status(200).json({ success: true, borrowalsList: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Add borrowal (issue a book)
const addBorrowal = async (req, res) => {
  try {
    const { bookId, memberId, issueDate, dueDate } = req.body;

    // Check book exists and is available
    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (book.availableCopies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies available for this book' });
    }

    // Check student exists
    const member = await User.findById(memberId);
    if (!member) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    if (member.status === 'Blocked') {
      return res.status(403).json({ success: false, message: 'Student is blocked and cannot borrow books' });
    }
    if (member.availableBookLimit <= 0) {
      return res.status(400).json({ success: false, message: 'Student has reached maximum book limit' });
    }

    // Check if student already has this book issued
    const alreadyIssued = await Borrowal.findOne({ bookId, memberId, status: { $in: ['issued', 'overdue'] } });
    if (alreadyIssued) {
      return res.status(400).json({ success: false, message: 'This book is already issued to this student' });
    }

    const newBorrowal = await Borrowal.create({
      bookId,
      memberId,
      issueDate: issueDate || new Date(),
      dueDate: dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'issued',
      issuedBy: req.user ? req.user._id : null
    });

    // Update book available copies
    await Book.findByIdAndUpdate(bookId, {
      $inc: { availableCopies: -1 },
      isAvailable: book.availableCopies - 1 > 0
    });

    // Update member's borrow count
    await User.findByIdAndUpdate(memberId, { $inc: { totalBooksIssued: 1 } });

    const populated = await Borrowal.findById(newBorrowal._id)
      .populate('bookId', 'name isbn photoUrl')
      .populate('memberId', 'name email scholarNumber');

    return res.status(201).json({ success: true, newBorrowal: populated });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Return a book
const returnBorrowal = async (req, res) => {
  try {
    const borrowalId = req.params.id;
    const { returnDate, fine } = req.body;

    const borrowal = await Borrowal.findById(borrowalId);
    if (!borrowal) {
      return res.status(404).json({ success: false, message: 'Borrowal not found' });
    }
    if (borrowal.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Book already returned' });
    }

    const actualReturnDate = returnDate ? new Date(returnDate) : new Date();
    const today = actualReturnDate;
    let calculatedFine = fine || 0;

    // Auto-calculate fine if not provided
    if (!fine && new Date(borrowal.dueDate) < today) {
      const diffMs = today - new Date(borrowal.dueDate);
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      calculatedFine = diffDays * 5; // Rs.5 per day
    }

    borrowal.returnDate = actualReturnDate;
    borrowal.status = 'returned';
    borrowal.fine = calculatedFine;
    borrowal.fineStatus = calculatedFine > 0 ? 'Unpaid' : null;
    await borrowal.save();

    // Restore book available copies
    const book = await Book.findById(borrowal.bookId);
    if (book) {
      const newAvailable = book.availableCopies + 1;
      await Book.findByIdAndUpdate(borrowal.bookId, {
        availableCopies: newAvailable,
        isAvailable: true
      });
    }

    // Decrease member's borrow count
    const incUpdate = { totalBooksIssued: -1 };
    if (calculatedFine > 0) incUpdate.unpaidFine = calculatedFine;
    await User.findByIdAndUpdate(borrowal.memberId, { $inc: incUpdate });

    return res.status(200).json({ success: true, updatedBorrowal: borrowal });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Update borrowal (general update)
const updateBorrowal = async (req, res) => {
  try {
    const borrowalId = req.params.id;
    const updated = await Borrowal.findByIdAndUpdate(borrowalId, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Borrowal not found' });
    }
    return res.status(200).json({ success: true, updatedBorrowal: updated });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Delete borrowal
const deleteBorrowal = async (req, res) => {
  try {
    const borrowal = await Borrowal.findByIdAndDelete(req.params.id);
    if (!borrowal) {
      return res.status(404).json({ success: false, message: 'Borrowal not found' });
    }
    // Restore book if was still issued
    if (borrowal.status !== 'returned') {
      await Book.findByIdAndUpdate(borrowal.bookId, { $inc: { availableCopies: 1 }, isAvailable: true });
      await User.findByIdAndUpdate(borrowal.memberId, { $inc: { totalBooksIssued: -1 } });
    }
    return res.status(200).json({ success: true, deletedBorrowal: borrowal });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get all borrowals for a specific student
const getBorrowalsByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const borrowals = await Borrowal.find({ memberId: studentId })
      .populate('bookId', 'name isbn photoUrl')
      .sort({ issueDate: -1 });

    const today = new Date();
    const formatted = borrowals.map(b => {
      const obj = b.toObject();
      obj.bookName = obj.bookId?.name || '';
      obj.isOverdue = obj.status === 'issued' && obj.dueDate && new Date(obj.dueDate) < today;
      if (obj.isOverdue) {
        const diffMs = today - new Date(obj.dueDate);
        obj.lateDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        obj.fine = obj.lateDays * 5;
      } else {
        obj.lateDays = 0;
      }
      return obj;
    });

    return res.status(200).json({ success: true, borrowalsList: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get only currently issued (active) books for a student
const getIssuedBooksByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const borrowals = await Borrowal.find({ memberId: studentId, status: { $in: ['issued', 'overdue'] } })
      .populate('bookId', 'name isbn photoUrl')
      .sort({ issueDate: -1 });

    const today = new Date();
    const formatted = borrowals.map(b => {
      const obj = b.toObject();
      obj.bookName = obj.bookId?.name || '';
      obj.isOverdue = obj.dueDate && new Date(obj.dueDate) < today;
      if (obj.isOverdue) {
        const diffMs = today - new Date(obj.dueDate);
        obj.lateDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        obj.fine = obj.lateDays * 5;
      } else {
        obj.lateDays = 0;
        obj.fine = 0;
      }
      return obj;
    });

    return res.status(200).json({ success: true, issuedBooks: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Search available books (for issue dialog)
const searchAvailableBooks = async (req, res) => {
  try {
    const { search } = req.query;
    const filter = { availableCopies: { $gt: 0 } };

    if (search && search.trim().length >= 2) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } }
      ];
    }

    const books = await Book.find(filter)
      .populate('authorId', 'name')
      .populate('genreId', 'name')
      .select('name isbn photoUrl availableCopies totalCopies authorId genreId')
      .limit(20);

    return res.status(200).json({ success: true, booksList: books });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

module.exports = {
  getBorrowal,
  getAllBorrowals,
  addBorrowal,
  returnBorrowal,
  updateBorrowal,
  deleteBorrowal,
  getBorrowalsByStudent,
  getIssuedBooksByStudent,
  searchAvailableBooks
};
