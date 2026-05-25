const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
  name: { type: String, required: true },
  isbn: { type: String, required: true, unique: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Author', required: false },
  genreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Genre', required: false },
  isAvailable: { type: Boolean, required: true, default: true },
  summary: { type: String, required: false },
  photoUrl: { type: String },

  // Extended fields
  rfidTag: { type: String, sparse: true },
  totalCopies: { type: Number, default: 1, min: 1 },
  availableCopies: { type: Number, default: 1, min: 0 },
  publishYear: { type: String },
  location: { type: String }  // shelf location e.g. "A-001"
}, { timestamps: true });

module.exports = mongoose.model('Book', bookSchema);
