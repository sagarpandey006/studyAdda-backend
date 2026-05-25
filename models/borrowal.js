const mongoose = require('mongoose');

const borrowalSchema = new mongoose.Schema({
  bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  issueDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  returnDate: { type: Date, default: null },
  status: {
    type: String,
    enum: ['issued', 'returned', 'overdue'],
    default: 'issued'
  },
  fine: { type: Number, default: 0 },
  fineStatus: {
    type: String,
    enum: ['Paid', 'Unpaid', null],
    default: null
  },
  renewalCount: { type: Number, default: 0 },
  issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }   // admin who issued
}, { timestamps: true });

module.exports = mongoose.model('Borrowal', borrowalSchema);
