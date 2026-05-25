const Book = require('../models/book');
const User = require('../models/user');
const Borrowal = require('../models/borrowal');
const CheckIn = require('../models/checkin');
const Seat = require('../models/seat');

const getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Run all counts in parallel
    const [
      totalBooks,
      activeMembers,
      issuedToday,
      overdueBooks,
      seatStats,
      todayCheckIns
    ] = await Promise.all([
      Book.countDocuments(),
      User.countDocuments({ isAdmin: false, status: 'Active' }),
      Borrowal.countDocuments({ issueDate: { $gte: today, $lt: tomorrow }, status: 'issued' }),
      Borrowal.countDocuments({ status: { $in: ['issued', 'overdue'] }, dueDate: { $lt: today } }),
      Seat.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
            occupied: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
            booked: { $sum: { $cond: [{ $eq: ['$status', 'booked'] }, 1, 0] } }
          }
        }
      ]),
      CheckIn.countDocuments({ checkInTime: { $gte: today, $lt: tomorrow } })
    ]);

    // Library activity for last 7 days (check-ins per day)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const activityData = await CheckIn.aggregate([
      { $match: { checkInTime: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$checkInTime' },
            month: { $month: '$checkInTime' },
            day: { $dayOfMonth: '$checkInTime' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Books issued per day for last 7 days
    const borrowalActivity = await Borrowal.aggregate([
      { $match: { issueDate: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            year: { $year: '$issueDate' },
            month: { $month: '$issueDate' },
            day: { $dayOfMonth: '$issueDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Books by genre (for donut chart)
    const booksByGenre = await Book.aggregate([
      {
        $lookup: {
          from: 'genres',
          localField: 'genreId',
          foreignField: '_id',
          as: 'genre'
        }
      },
      { $unwind: { path: '$genre', preserveNullAndEmpty: true } },
      {
        $group: {
          _id: { $ifNull: ['$genre.name', 'Uncategorized'] },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]);

    const seats = seatStats[0] || { total: 0, available: 0, occupied: 0, booked: 0 };

    return res.status(200).json({
      success: true,
      data: {
        summaryCards: {
          totalBooks,
          activeMembers,
          issuedToday,
          overdueBooks
        },
        seats: {
          total: seats.total,
          available: seats.available,
          occupied: seats.occupied,
          booked: seats.booked,
          occupancyRate: seats.total > 0 ? ((seats.occupied / seats.total) * 100).toFixed(1) : 0
        },
        todayCheckIns,
        activityChart: {
          checkIns: activityData,
          booksIssued: borrowalActivity
        },
        booksByGenre: booksByGenre.map(g => ({ label: g._id, value: g.count }))
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

module.exports = { getDashboardStats };
