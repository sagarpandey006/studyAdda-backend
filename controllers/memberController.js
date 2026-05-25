const User = require('../models/user');
const Borrowal = require('../models/borrowal');
const CheckIn = require('../models/checkin');
const Seat = require('../models/seat');
const Payment = require('../models/payment');

// ─────────────────────────────────────────────
// Helper: calculate overdue fine for a borrowal
// ─────────────────────────────────────────────
const calcFine = (borrowal) => {
  const today = new Date();
  const obj = borrowal.toObject ? borrowal.toObject() : borrowal;
  if ((obj.status === 'issued' || obj.status === 'overdue') && obj.dueDate && new Date(obj.dueDate) < today) {
    const diffMs = today - new Date(obj.dueDate);
    const lateDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { isOverdue: true, lateDays, fine: lateDays * 5 };
  }
  return { isOverdue: false, lateDays: 0, fine: 0 };
};

// ─────────────────────────────────────────────
// GET /api/member/dashboard
// Member's personalised dashboard stats
// ─────────────────────────────────────────────
const getMemberDashboard = async (req, res) => {
  try {
    const memberId = req.user._id;

    const [
      activeBorrowals,
      allBorrowalsCount,
      currentCheckin,
      currentSeat,
      recentCheckins,
      recentPayments,
      member
    ] = await Promise.all([
      Borrowal.find({ memberId, status: { $in: ['issued', 'overdue'] } })
        .populate('bookId', 'name isbn photoUrl')
        .sort({ dueDate: 1 }),

      Borrowal.countDocuments({ memberId }),

      CheckIn.findOne({ studentId: memberId, status: 'checked-in' }),

      Seat.findOne({ bookedBy: memberId, status: { $in: ['booked', 'occupied'] } }),

      CheckIn.find({ studentId: memberId }).sort({ checkInTime: -1 }).limit(5),

      Payment.find({ studentId: memberId }).sort({ paymentDate: -1 }).limit(5),

      User.findById(memberId).select('unpaidFine fineAmount maxBookLimit totalBooksIssued name')
    ]);

    const enrichedActive = activeBorrowals.map(b => {
      const obj = b.toObject();
      const { isOverdue, lateDays, fine } = calcFine(b);
      return { ...obj, isOverdue, lateDays, calculatedFine: fine };
    });

    const overdueCount = enrichedActive.filter(b => b.isOverdue).length;
    const totalCalculatedFine = enrichedActive.reduce((sum, b) => sum + b.calculatedFine, 0);

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          issuedBooksCount: activeBorrowals.length,
          overdueCount,
          totalBorrowalsCount: allBorrowalsCount,
          availableBookLimit: member.maxBookLimit - member.totalBooksIssued,
          maxBookLimit: member.maxBookLimit,
          unpaidFine: member.unpaidFine || 0,
          calculatedPendingFine: totalCalculatedFine
        },
        checkinStatus: {
          isCheckedIn: !!currentCheckin,
          checkInTime: currentCheckin ? currentCheckin.checkInTime : null,
          checkInId: currentCheckin ? currentCheckin._id : null,
          durationSoFar: currentCheckin
            ? Math.round((new Date() - currentCheckin.checkInTime) / (1000 * 60))
            : null
        },
        seatStatus: {
          hasActiveBooking: !!currentSeat,
          seat: currentSeat
            ? {
                seatNumber: currentSeat.seatNumber,
                floor: currentSeat.floor,
                section: currentSeat.section,
                status: currentSeat.status,
                bookingStartTime: currentSeat.bookingStartTime,
                bookingEndTime: currentSeat.bookingEndTime
              }
            : null
        },
        activeBooks: enrichedActive,
        recentCheckins,
        recentPayments
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-borrowals
// Full borrowal history for logged-in member
// Query: ?status=issued|returned|overdue
// ─────────────────────────────────────────────
const getMyBorrowals = async (req, res) => {
  try {
    const memberId = req.user._id;
    const filter = { memberId };
    if (req.query.status) filter.status = req.query.status;

    const borrowals = await Borrowal.find(filter)
      .populate({
        path: 'bookId',
        select: 'name isbn photoUrl location',
        populate: [
          { path: 'authorId', select: 'name' },
          { path: 'genreId', select: 'name' }
        ]
      })
      .sort({ issueDate: -1 });

    const formatted = borrowals.map(b => {
      const obj = b.toObject();
      const { isOverdue, lateDays, fine } = calcFine(b);
      return { ...obj, isOverdue, lateDays, calculatedFine: fine };
    });

    return res.status(200).json({ success: true, borrowalsList: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-issued-books
// Only currently issued / overdue books
// ─────────────────────────────────────────────
const getMyIssuedBooks = async (req, res) => {
  try {
    const memberId = req.user._id;

    const borrowals = await Borrowal.find({ memberId, status: { $in: ['issued', 'overdue'] } })
      .populate({
        path: 'bookId',
        select: 'name isbn photoUrl location',
        populate: [
          { path: 'authorId', select: 'name' },
          { path: 'genreId', select: 'name' }
        ]
      })
      .sort({ dueDate: 1 });

    const formatted = borrowals.map(b => {
      const obj = b.toObject();
      const { isOverdue, lateDays, fine } = calcFine(b);
      return { ...obj, isOverdue, lateDays, calculatedFine: fine };
    });

    return res.status(200).json({ success: true, issuedBooks: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-checkins
// Own check-in/out history — paginated
// Query: ?page=1&limit=20
// ─────────────────────────────────────────────
const getMyCheckIns = async (req, res) => {
  try {
    const memberId = req.user._id;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      CheckIn.find({ studentId: memberId })
        .sort({ checkInTime: -1 })
        .skip(skip)
        .limit(limit),
      CheckIn.countDocuments({ studentId: memberId })
    ]);

    return res.status(200).json({
      success: true,
      history: records,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-current-checkin
// Is logged-in member currently checked in?
// ─────────────────────────────────────────────
const getMyCurrentCheckIn = async (req, res) => {
  try {
    const record = await CheckIn.findOne({ studentId: req.user._id, status: 'checked-in' });

    if (!record) {
      return res.status(200).json({ success: true, isCheckedIn: false, record: null });
    }

    const durationSoFar = Math.round((new Date() - record.checkInTime) / (1000 * 60));

    return res.status(200).json({ success: true, isCheckedIn: true, record, durationSoFar });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-payments
// Own payment history
// ─────────────────────────────────────────────
const getMyPayments = async (req, res) => {
  try {
    const payments = await Payment.find({ studentId: req.user._id })
      .populate('borrowalId', 'bookId issueDate dueDate')
      .sort({ paymentDate: -1 });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return res.status(200).json({ success: true, paymentsList: payments, totalPaid });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-fines
// Pending unpaid fines (overdue + returned-unpaid)
// ─────────────────────────────────────────────
const getMyFines = async (req, res) => {
  try {
    const memberId = req.user._id;
    const today = new Date();

    const [overdueBooks, returnedUnpaid, member] = await Promise.all([
      // Books still issued but past due date
      Borrowal.find({ memberId, status: { $in: ['issued', 'overdue'] }, dueDate: { $lt: today } })
        .populate('bookId', 'name isbn photoUrl')
        .sort({ dueDate: 1 }),

      // Returned books with unpaid fine recorded in DB
      Borrowal.find({ memberId, status: 'returned', fine: { $gt: 0 }, fineStatus: 'Unpaid' })
        .populate('bookId', 'name isbn')
        .sort({ returnDate: -1 }),

      User.findById(memberId).select('unpaidFine')
    ]);

    const overdueFines = overdueBooks.map(b => {
      const obj = b.toObject();
      const { lateDays, fine } = calcFine(b);
      return { ...obj, lateDays, calculatedFine: fine };
    });

    const totalCalculatedFine = overdueFines.reduce((sum, b) => sum + b.calculatedFine, 0);
    const totalReturnedFine = returnedUnpaid.reduce((sum, b) => sum + b.fine, 0);

    return res.status(200).json({
      success: true,
      data: {
        overdueBooks: overdueFines,
        returnedUnpaidFines: returnedUnpaid,
        totalCalculatedFine,
        totalReturnedUnpaidFine: totalReturnedFine,
        profileUnpaidFine: member.unpaidFine || 0
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/profile
// Get own full profile
// ─────────────────────────────────────────────
const getMyProfile = async (req, res) => {
  try {
    const member = await User.findById(req.user._id)
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires');

    if (!member) {
      return res.status(404).json({ success: false, message: 'Member not found' });
    }

    return res.status(200).json({ success: true, user: member });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/member/profile
// Update own profile (self-editable fields only)
// ─────────────────────────────────────────────
const updateMyProfile = async (req, res) => {
  try {
    const allowed = ['name', 'phone', 'address', 'photoUrl', 'dob'];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No updatable fields provided' });
    }

    const updated = await User.findByIdAndUpdate(req.user._id, updates, { new: true })
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires');

    return res.status(200).json({ success: true, user: updated });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// PUT /api/member/change-password
// Change own password (requires current password)
// ─────────────────────────────────────────────
const changeMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const member = await User.findById(req.user._id);

    if (!member.isValidPassword(currentPassword)) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    member.setPassword(newPassword);
    await member.save();

    return res.status(200).json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-seat
// Current active seat booking
// ─────────────────────────────────────────────
const getMySeat = async (req, res) => {
  try {
    const seat = await Seat.findOne({
      bookedBy: req.user._id,
      status: { $in: ['booked', 'occupied'] }
    });

    return res.status(200).json({ success: true, hasBooking: !!seat, seat: seat || null });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /api/member/my-seat-history
// Past seat bookings (last 30)
// ─────────────────────────────────────────────
const getMySeatHistory = async (req, res) => {
  try {
    const seats = await Seat.find({ bookedBy: req.user._id })
      .sort({ bookingDate: -1 })
      .limit(30);

    return res.status(200).json({ success: true, seatHistory: seats });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /api/member/renew/:borrowalId
// Renew a currently issued book (extend due date by 15 days)
// Constraints: no pending fine, renewalCount < 3
// ─────────────────────────────────────────────
const renewMyBorrowal = async (req, res) => {
  try {
    const { borrowalId } = req.params;
    const MAX_RENEWALS = 3;

    const borrowal = await Borrowal.findOne({ _id: borrowalId, memberId: req.user._id });

    if (!borrowal) {
      return res.status(404).json({ success: false, message: 'Borrowal not found' });
    }

    if (borrowal.status !== 'issued' && borrowal.status !== 'overdue') {
      return res.status(400).json({ success: false, message: 'Only currently issued books can be renewed' });
    }

    if (borrowal.renewalCount >= MAX_RENEWALS) {
      return res.status(400).json({ success: false, message: `Maximum ${MAX_RENEWALS} renewals allowed` });
    }

    const { fine } = calcFine(borrowal);
    if (fine > 0) {
      return res.status(400).json({ success: false, message: 'Please clear your pending fine before renewing' });
    }

    // Extend due date by 15 days from today (or current due date if not yet overdue)
    const baseDue = new Date(borrowal.dueDate) > new Date() ? new Date(borrowal.dueDate) : new Date();
    const newDueDate = new Date(baseDue);
    newDueDate.setDate(newDueDate.getDate() + 15);

    borrowal.dueDate = newDueDate;
    borrowal.renewalCount = (borrowal.renewalCount || 0) + 1;
    borrowal.status = 'issued'; // reset from overdue if any
    await borrowal.save();

    return res.status(200).json({
      success: true,
      message: 'Book renewed successfully',
      newDueDate,
      renewalCount: borrowal.renewalCount
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

module.exports = {
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
};
