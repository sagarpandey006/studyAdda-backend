const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  seatNumber: {
    type: String,
    required: true,
    unique: true
  },
  floor: {
    type: Number,
    required: true,
    default: 1
  },
  section: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D'],
    default: 'A'
  },
  status: {
    type: String,
    required: true,
    enum: ['available', 'booked', 'occupied', 'maintenance'],
    default: 'available'
  },
  bookedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  bookingDate: {
    type: Date,
    default: null
  },
  bookingStartTime: {
    type: Date,
    default: null
  },
  bookingEndTime: {
    type: Date,
    default: null
  },
  isAdvanceBooking: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Index for faster queries
seatSchema.index({ status: 1, floor: 1, section: 1 });
seatSchema.index({ bookedBy: 1 });
seatSchema.index({ bookingDate: 1 });

module.exports = mongoose.model('Seat', seatSchema);
