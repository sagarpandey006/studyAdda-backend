const mongoose = require('mongoose');

const rfidSessionSchema = new mongoose.Schema({
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    scannedBooks: [
        {
            bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
            rfidTag: String
        }
    ],
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('RFIDSession', rfidSessionSchema);