const mongoose = require('mongoose');

const checkInSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rfidCard: {
    type: String,
    required: true
  },
  checkInTime: {
    type: Date,
    default: Date.now
  },
  checkOutTime: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['checked-in', 'checked-out'],
    default: 'checked-in'
  },
  // Duration in minutes (filled on checkout)
  duration: {
    type: Number,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('CheckIn', checkInSchema);
