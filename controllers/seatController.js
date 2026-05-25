const Seat = require('../models/seat');

// Get all seats with optional filters
exports.getAllSeats = async (req, res) => {
  try {
    const { status, floor, section, date } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (floor) filter.floor = parseInt(floor);
    if (section) filter.section = section;

    // Filter for specific date bookings if date provided
    if (date) {
      const queryDate = new Date(date);
      const startOfDay = new Date(queryDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(queryDate.setHours(23, 59, 59, 999));

      filter.$or = [
        { status: 'available' },
        {
          bookingDate: { $gte: startOfDay, $lte: endOfDay }
        }
      ];
    }

    const seats = await Seat.find(filter)
      .populate('bookedBy', 'name email scholarNumber enrollmentNumber')
      .sort({ floor: 1, section: 1, seatNumber: 1 });

    res.status(200).json({
      success: true,
      count: seats.length,
      data: seats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching seats',
      error: error.message
    });
  }
};

// Get seat statistics
exports.getSeatStatistics = async (req, res) => {
  try {
    const total = await Seat.countDocuments();
    const available = await Seat.countDocuments({ status: 'available' });
    const booked = await Seat.countDocuments({ status: 'booked' });
    const occupied = await Seat.countDocuments({ status: 'occupied' });
    const maintenance = await Seat.countDocuments({ status: 'maintenance' });

    // Get today's bookings
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Seat.countDocuments({
      bookingDate: { $gte: today, $lt: tomorrow }
    });

    res.status(200).json({
      success: true,
      data: {
        total,
        available,
        booked,
        occupied,
        maintenance,
        todayBookings,
        occupancyRate: total > 0 ? ((occupied / total) * 100).toFixed(2) : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching seat statistics',
      error: error.message
    });
  }
};

// Get a single seat by ID
exports.getSeatById = async (req, res) => {
  try {
    const seat = await Seat.findById(req.params.id).populate('bookedBy', 'name email scholarNumber enrollmentNumber');

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    res.status(200).json({
      success: true,
      data: seat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching seat',
      error: error.message
    });
  }
};

// Create a new seat (Admin only)
exports.createSeat = async (req, res) => {
  try {
    const seat = await Seat.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Seat created successfully',
      data: seat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating seat',
      error: error.message
    });
  }
};

// Book a seat
exports.bookSeat = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { bookingDate, startTime, endTime, isAdvanceBooking, notes } = req.body;
    const userId = req.user._id;

    const seat = await Seat.findById(seatId);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    // Check if seat is available
    if (seat.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: `Seat is currently ${seat.status}`
      });
    }

    // Check if user already has an active booking
    if (req.user.role !== 'admin') {
      const existingBooking = await Seat.findOne({
        bookedBy: userId,
        status: { $in: ['booked', 'occupied'] }
      });

      if (existingBooking) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active seat booking'
        });
      }
    }

    // if (existingBooking) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'You already have an active seat booking. Please release it first.'
    //   });
    // }

    // Update seat status
    // seat.status = isAdvanceBooking ? 'booked' : 'occupied';
    const CheckIn = require('../models/checkin');

    const activeCheckIn = await CheckIn.findOne({
      studentId: userId,
      status: 'checked-in'
    });

    const now = new Date();
    const expiry = new Date(now.getTime() + 20 * 60000);

    if (activeCheckIn) {
      seat.status = "occupied";
    } else {
      seat.status = "booked";
      seat.bookingEndTime = expiry;
    }

    seat.bookedBy = userId;
    seat.bookingDate = now;
    seat.bookingStartTime = now;
    seat.isAdvanceBooking = false;
    seat.notes = notes || '';

    await seat.save();

    const populatedSeat = await Seat.findById(seat._id).populate('bookedBy', 'name email scholarNumber enrollmentNumber');

    res.status(200).json({
      success: true,
      message: 'Seat booked successfully',
      data: populatedSeat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error booking seat',
      error: error.message
    });
  }
};

// Release a seat
exports.releaseSeat = async (req, res) => {
  try {
    const { seatId } = req.params;
    const userId = req.user._id;

    const seat = await Seat.findById(seatId);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    // Check if the seat is booked by the current user or if user is admin
    if (seat.bookedBy && seat.bookedBy.toString() !== userId.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to release this seat'
      });
    }

    // Reset seat to available
    seat.status = 'available';
    seat.bookedBy = null;
    seat.bookingDate = null;
    seat.bookingStartTime = null;
    seat.bookingEndTime = null;
    seat.isAdvanceBooking = false;
    seat.notes = '';

    await seat.save();

    res.status(200).json({
      success: true,
      message: 'Seat released successfully',
      data: seat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error releasing seat',
      error: error.message
    });
  }
};

// Get user's booking history
exports.getUserBookings = async (req, res) => {
  try {
    const userId = req.params.userId || req.user._id;

    const bookings = await Seat.find({ bookedBy: userId })
      .populate('bookedBy', 'name email scholarNumber enrollmentNumber')
      .sort({ bookingDate: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching user bookings',
      error: error.message
    });
  }
};

// Get current active booking for user
exports.getCurrentBooking = async (req, res) => {
  try {
    const userId = req.user._id;

    const booking = await Seat.findOne({
      bookedBy: userId,
      status: { $in: ['booked', 'occupied'] }
    }).populate('bookedBy', 'name email scholarNumber enrollmentNumber');

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching current booking',
      error: error.message
    });
  }
};

// Update seat status (Admin only)
exports.updateSeatStatus = async (req, res) => {
  try {
    const { seatId } = req.params;
    const { status } = req.body;

    const seat = await Seat.findById(seatId);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    seat.status = status;

    // If setting to maintenance or available, clear booking info
    if (status === 'maintenance' || status === 'available') {
      seat.bookedBy = null;
      seat.bookingDate = null;
      seat.bookingStartTime = null;
      seat.bookingEndTime = null;
      seat.isAdvanceBooking = false;
    }

    await seat.save();

    res.status(200).json({
      success: true,
      message: 'Seat status updated successfully',
      data: seat
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating seat status',
      error: error.message
    });
  }
};

// Delete a seat (Admin only)
exports.deleteSeat = async (req, res) => {
  try {
    const seat = await Seat.findByIdAndDelete(req.params.id);

    if (!seat) {
      return res.status(404).json({
        success: false,
        message: 'Seat not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Seat deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting seat',
      error: error.message
    });
  }
};

// Initialize seats (for initial setup)
exports.initializeSeats = async (req, res) => {
  try {
    // Check if seats already exist
    const existingSeats = await Seat.countDocuments();
    if (existingSeats > 0) {
      return res.status(400).json({
        success: false,
        message: 'Seats already initialized'
      });
    }

    const seats = [];
    const sections = ['A', 'B', 'C', 'D'];
    const floors = [1, 2, 3];
    const seatsPerSection = 15;

    for (const floor of floors) {
      for (const section of sections) {
        for (let i = 1; i <= seatsPerSection; i++) {
          seats.push({
            seatNumber: `${floor}${section}${i.toString().padStart(2, '0')}`,
            floor,
            section,
            status: 'available'
          });
        }
      }
    }

    await Seat.insertMany(seats);

    res.status(201).json({
      success: true,
      message: `${seats.length} seats initialized successfully`,
      data: { count: seats.length }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error initializing seats',
      error: error.message
    });
  }
};


// Admin seat booking for any student
exports.adminBookSeat = async (req, res) => {
  try {
    const { seatId, studentId } = req.body;

    const seat = await Seat.findById(seatId);
    if (!seat) {
      return res.status(404).json({ success: false, message: "Seat not found" });
    }

    if (seat.status !== "available") {
      return res.status(400).json({ success: false, message: "Seat already occupied/booked" });
    }

    // IMPORTANT: check student already has seat
    const existingSeat = await Seat.findOne({
      bookedBy: studentId,
      status: { $in: ["booked", "occupied"] }
    });

    if (existingSeat) {
      return res.status(400).json({
        success: false,
        message: "This student already has an active seat"
      });
    }

    // check student check-in
    const CheckIn = require('../models/checkin');
    const activeCheckIn = await CheckIn.findOne({
      studentId,
      status: "checked-in"
    });

    seat.bookedBy = studentId;
    seat.bookingDate = new Date();
    seat.bookingStartTime = new Date();

    if (activeCheckIn) {
      seat.status = "occupied";
    } else {
      seat.status = "booked";

      // 20 min expiry
      seat.bookingEndTime = new Date(Date.now() + 20 * 60000);
    }

    await seat.save();

    const populated = await Seat.findById(seatId)
      .populate("bookedBy", "name email scholarNumber");

    res.json({
      success: true,
      message: "Seat booked by admin",
      data: populated
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
