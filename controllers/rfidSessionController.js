const RFIDSession = require('../models/rfidSession');
const User = require('../models/user');
const Book = require('../models/book');
const Borrowal = require('../models/borrowal');

const scanRFID = async (req, res) => {
    const { rfid } = req.body;

    const user = await User.findOne({ rfidCard: rfid });
    const activeSession = await RFIDSession.findOne({ isActive: true });

    // USER SCAN
    if (user) {

        if (activeSession && activeSession.memberId.toString() !== user._id.toString()) {
            return res.status(400).json({
                message: "Another session is active. Complete it first."
            });
        }

        // SAME USER → checkout
        if (activeSession && activeSession.memberId.toString() === user._id.toString()) {

            for (let item of activeSession.scannedBooks) {
                const book = await Book.findById(item.bookId);

                if (book.availableCopies > 0) {
                    await Borrowal.create({
                        bookId: book._id,
                        memberId: user._id,
                        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
                    });

                    await Book.findByIdAndUpdate(book._id, {
                        $inc: { availableCopies: -1 }
                    });

                    await User.findByIdAndUpdate(user._id, {
                        $inc: { totalBooksIssued: 1 }
                    });
                }
            }

            activeSession.isActive = false;
            await activeSession.save();

            return res.json({ message: "Books issued successfully" });
        }

        // NO session → start
        const session = await RFIDSession.create({ memberId: user._id });

        return res.json({ message: "Session started", session });
    }

    // BOOK SCAN
    const book = await Book.findOne({ rfidTag: rfid });

    if (book) {

        // AUTO RETURN (NO SESSION)
        if (!activeSession) {

            const borrowal = await Borrowal.findOne({
                bookId: book._id,
                status: { $in: ['issued', 'overdue'] }
            });

            if (!borrowal) {
                return res.status(400).json({
                    message: "Book is not issued to anyone"
                });
            }

            // RETURN
            borrowal.status = 'returned';
            borrowal.returnDate = new Date();

            const today = new Date();
            if (borrowal.dueDate && borrowal.dueDate < today) {
                const diffDays = Math.ceil((today - borrowal.dueDate) / (1000 * 60 * 60 * 24));
                borrowal.fine = diffDays * 5;
                borrowal.fineStatus = 'Unpaid';
            }

            await borrowal.save();

            await Book.findByIdAndUpdate(book._id, {
                $inc: { availableCopies: 1 },
                isAvailable: true
            });

            await User.findByIdAndUpdate(borrowal.memberId, {
                $inc: { totalBooksIssued: -1 }
            });

            return res.json({
                message: "Book returned successfully",
                fine: borrowal.fine || 0
            });
        }

        // ADD TO SESSION
        const session = activeSession;

        // duplicate check
        const already = session.scannedBooks.find(
            b => b.bookId.toString() === book._id.toString()
        );

        if (already) {
            return res.json({ message: "Book already scanned" });
        }

        if (book.availableCopies <= 0) {
            return res.json({ message: "Book not available" });
        }

        session.scannedBooks.push({
            bookId: book._id,
            rfidTag: rfid
        });

        await session.save();

        return res.json({ message: "Book added", book });
    }

    return res.status(404).json({ message: "RFID not recognized" });
};

module.exports = { scanRFID };