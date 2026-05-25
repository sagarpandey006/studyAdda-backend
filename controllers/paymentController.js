const Payment = require('../models/payment');
const User = require('../models/user');
const Borrowal = require('../models/borrowal');
const crypto = require('crypto');

// Collect a fine payment from student
const collectFine = async (req, res) => {
  try {
    const { studentId, amount, paymentMethod, receiptNumber, paymentDate, borrowalId, notes } = req.body;

    if (!studentId || !amount || !paymentMethod) {
      return res.status(400).json({ success: false, message: 'studentId, amount, and paymentMethod are required' });
    }

    const student = await User.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Auto-generate receipt number if not provided
    const receipt = receiptNumber || `REC-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    const payment = await Payment.create({
      studentId,
      amount,
      paymentMethod,
      paymentType: 'Fine',
      receiptNumber: receipt,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      borrowalId: borrowalId || null,
      collectedBy: req.user._id,
      notes: notes || ''
    });

    // Reduce student's unpaid fine
    const newUnpaid = Math.max(0, (student.unpaidFine || 0) - amount);
    const newTotal = Math.max(0, (student.fineAmount || 0) - amount);
    await User.findByIdAndUpdate(studentId, {
      unpaidFine: newUnpaid,
      fineAmount: newTotal
    });

    // If linked to a borrowal, mark fine as paid
    if (borrowalId) {
      await Borrowal.findByIdAndUpdate(borrowalId, { fineStatus: 'Paid' });
    }

    return res.status(201).json({
      success: true,
      message: 'Payment collected successfully',
      payment,
      receiptNumber: receipt
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get all payments (admin)
const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('studentId', 'name email scholarNumber enrollmentNumber')
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 });

    return res.status(200).json({ success: true, paymentsList: payments });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get payment history for a specific student
const getStudentPayments = async (req, res) => {
  try {
    const { studentId } = req.params;
    const payments = await Payment.find({ studentId })
      .populate('collectedBy', 'name')
      .sort({ paymentDate: -1 });

    return res.status(200).json({ success: true, paymentsList: payments });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get payment summary stats
const getPaymentStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [totalCollected, todayCollected, totalStudentsWithFine] = await Promise.all([
      Payment.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Payment.aggregate([
        { $match: { paymentDate: { $gte: today, $lt: tomorrow } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      User.countDocuments({ unpaidFine: { $gt: 0 }, isAdmin: false })
    ]);

    const totalUnpaidFine = await User.aggregate([
      { $match: { isAdmin: false } },
      { $group: { _id: null, total: { $sum: '$unpaidFine' } } }
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalCollected: totalCollected[0]?.total || 0,
        todayCollected: todayCollected[0]?.total || 0,
        totalUnpaid: totalUnpaidFine[0]?.total || 0,
        studentsWithFine: totalStudentsWithFine
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

module.exports = {
  collectFine,
  getAllPayments,
  getStudentPayments,
  getPaymentStats
};
