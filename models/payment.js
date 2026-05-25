const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'Card', 'UPI', 'Net Banking'],
    required: true
  },
  paymentType: {
    type: String,
    enum: ['Fine', 'Other'],
    default: 'Fine'
  },
  receiptNumber: {
    type: String
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  // Optionally linked to a specific borrowal
  borrowalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Borrowal',
    default: null
  },
  // Admin who collected the payment
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  notes: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('Payment', paymentSchema);
