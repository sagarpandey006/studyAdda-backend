const mongoose = require("mongoose");
const crypto = require("crypto");

const lostDamagedBookSchema = new mongoose.Schema({
  bookName: { type: String, required: true },
  type: { type: String, enum: ['Lost', 'Damaged'], required: true },
  date: { type: Date, default: Date.now },
  fineAmount: { type: Number, default: 0 },
  status: { type: String, enum: ['Paid', 'Unpaid'], default: 'Unpaid' }
}, { _id: true });

const UserSchema = new mongoose.Schema({
  // Basic info
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  dob: { type: Date, required: false },
  phone: { type: String, required: false },
  isAdmin: { type: Boolean, required: true, default: false },
  photoUrl: { type: String, required: false, default: '' },

  // Auth
  hash: String,
  salt: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,

  // Student-specific fields (only for isAdmin: false users)
  scholarNumber: { type: String, sparse: true },
  enrollmentNumber: { type: String, sparse: true },
  rfidCard: { type: String, sparse: true },
  course: { type: String },
  branch: { type: String },
  year: { type: Number },
  semester: { type: Number },
  section: { type: String },
  address: { type: String },
  admissionDate: { type: Date },

  // Status & blocking
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Blocked'],
    default: 'Active'
  },
  blockReason: { type: String, default: null },

  // Fine tracking
  fineAmount: { type: Number, default: 0 },
  unpaidFine: { type: Number, default: 0 },

  // Book limits
  maxBookLimit: { type: Number, default: 5 },
  totalBooksIssued: { type: Number, default: 0 },

  // Lost/Damaged books
  lostDamagedBooks: [lostDamagedBookSchema]
}, { timestamps: true });

// Virtual for available book limit
UserSchema.virtual('availableBookLimit').get(function () {
  const active = this.totalBooksIssued || 0;
  return Math.max(0, this.maxBookLimit - active);
});

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

UserSchema.methods.setPassword = function (password) {
  this.salt = crypto.randomBytes(16).toString("hex");
  this.hash = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, `sha512`)
    .toString(`hex`);
};

UserSchema.methods.isValidPassword = function (password) {
  const hash = crypto
    .pbkdf2Sync(password, this.salt, 1000, 64, `sha512`)
    .toString(`hex`);
  return this.hash === hash;
};

module.exports = mongoose.model("User", UserSchema);
