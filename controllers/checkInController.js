const CheckIn = require('../models/checkin');
const User = require('../models/user');
const Seat = require('../models/seat');

// Get all check-in records (with student info joined)
const getAllCheckIns = async (req, res) => {
  try {
    const { status, date, selectedDate } = req.query;

    const filter = {};

    // status filter
    if (status && status !== 'all') {
      filter.status = status;
    }

    // SINGLE DATE FILTER
    if (selectedDate) {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      filter.checkInTime = {
        $gte: start,
        $lte: end
      };
    }

    // preset filters
    else if (date === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);

      filter.checkInTime = { $gte: today, $lt: tomorrow };
    }

    else if (date === 'week') {
      const today = new Date();
      const last7Days = new Date();
      last7Days.setDate(today.getDate() - 7);

      filter.checkInTime = {
        $gte: last7Days,
        $lte: today
      };
    }

    else if (date === 'month') {
      const today = new Date();
      const last30Days = new Date();
      last30Days.setDate(today.getDate() - 30);

      filter.checkInTime = {
        $gte: last30Days,
        $lte: today
      };
    }

    const records = await CheckIn.find(filter)
      .populate('studentId', 'name email scholarNumber enrollmentNumber photoUrl rfidCard')
      .sort({ checkInTime: -1 });

    // Shape for frontend
    const formatted = records.map(r => {
      const obj = r.toObject();
      obj.student = obj.studentId;
      return obj;
    });

    return res.status(200).json({ success: true, checkInsList: formatted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Check in a student via RFID
const checkInStudent = async (req, res) => {
  try {
    const { rfidCard } = req.body;

    if (!rfidCard) {
      return res.status(400).json({ success: false, message: 'RFID card is required' });
    }

    // Find student by RFID
    const student = await User.findOne({ rfidCard, isAdmin: false });
    if (!student) {
      return res.status(404).json({ success: false, message: 'No student found with this RFID card' });
    }
    if (student.status === 'Blocked') {
      return res.status(403).json({ success: false, message: `Student ${student.name} is blocked` });
    }

    // Check if already checked in
    const existing = await CheckIn.findOne({ studentId: student._id, status: 'checked-in' });
    if (existing) {
      return res.status(400).json({ success: false, message: `${student.name} is already checked in` });
    }

    const record = await CheckIn.create({
      studentId: student._id,
      rfidCard,
      checkInTime: new Date(),
      status: 'checked-in'
    });

    // for seat management
    const Seat = require('../models/seat');

    // after successful check-in
    const seat = await Seat.findOne({
      bookedBy: student._id,
      status: "booked"
    });

    if (seat) {
      seat.status = "occupied";
      await seat.save();
    }

    return res.status(201).json({
      success: true,
      message: `${student.name} checked in successfully`,
      student: { name: student.name, scholarNumber: student.scholarNumber, photoUrl: student.photoUrl },
      checkIn: record
    });

  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Check out a student by check-in record ID
const checkOutStudent = async (req, res) => {
  try {
    const { checkInId } = req.params;

    const record = await CheckIn.findById(checkInId).populate('studentId', 'name scholarNumber photoUrl');
    if (!record) {
      return res.status(404).json({ success: false, message: 'Check-in record not found' });
    }
    if (record.status === 'checked-out') {
      return res.status(400).json({ success: false, message: 'Student already checked out' });
    }

    const checkOutTime = new Date();
    const durationMs = checkOutTime - record.checkInTime;
    const durationMins = Math.round(durationMs / (1000 * 60));

    record.checkOutTime = checkOutTime;
    record.status = 'checked-out';
    record.duration = durationMins;
    await record.save();

    // seat management
    // const Seat = require('../models/seat');

    // after checkout
    const seat = await Seat.findOne({
      bookedBy: record.studentId._id,
      status: { $in: ["booked", "occupied"] }
    });

    if (seat) {
      seat.status = "available";
      seat.bookedBy = null;
      seat.bookingStartTime = null;
      seat.bookingEndTime = null;
      seat.bookingDate = null;

      await seat.save();
    }

    return res.status(200).json({
      success: true,
      message: `${record.studentId.name} checked out successfully`,
      student: { name: record.studentId.name },
      duration: durationMins,
      checkIn: record
    });

  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Check out by RFID (tap to exit)
const checkOutByRFID = async (req, res) => {
  try {
    const { rfidCard } = req.body;
    if (!rfidCard) {
      return res.status(400).json({ success: false, message: 'RFID card is required' });
    }

    const student = await User.findOne({ rfidCard, isAdmin: false });
    if (!student) {
      return res.status(404).json({ success: false, message: 'No student found with this RFID card' });
    }

    const record = await CheckIn.findOne({ studentId: student._id, status: 'checked-in' });
    if (!record) {
      return res.status(404).json({ success: false, message: `${student.name} is not currently checked in` });
    }

    const checkOutTime = new Date();
    const durationMins = Math.round((checkOutTime - record.checkInTime) / (1000 * 60));

    record.checkOutTime = checkOutTime;
    record.status = 'checked-out';
    record.duration = durationMins;
    await record.save();

    // seat management
    // const Seat = require('../models/seat');

    // after checkout
    const seat = await Seat.findOne({
      bookedBy: student._id,
      status: { $in: ["booked", "occupied"] }
    });

    if (seat) {
      seat.status = "available";
      seat.bookedBy = null;
      seat.bookingStartTime = null;
      seat.bookingEndTime = null;
      seat.bookingDate = null;

      await seat.save();
    }

    return res.status(200).json({
      success: true,
      message: `${student.name} checked out successfully`,
      student: { name: student.name },
      duration: durationMins,
      checkIn: record
    });

  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get check-in history for a specific student
const getStudentCheckInHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const records = await CheckIn.find({ studentId })
      .sort({ checkInTime: -1 })
      .limit(50);
    return res.status(200).json({ success: true, history: records });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// rfid tap checkin/checkout
const tapRFID = async (req, res) => {
  try {
    const { rfidCard } = req.body;

    if (!rfidCard) {
      return res.status(400).json({ success: false, message: 'RFID required' });
    }

    const student = await User.findOne({ rfidCard, isAdmin: false });

    if (!student) {
      return res.status(404).json({ success: false, message: 'Invalid RFID' });
    }

    if (student.status === 'Blocked') {
      return res.status(403).json({ success: false, message: 'Student blocked' });
    }

    // Check active session
    const active = await CheckIn.findOne({
      studentId: student._id,
      status: 'checked-in'
    });

    // =========================
    // CASE 1 → CHECK OUT
    // =========================
    if (active) {
      const now = new Date();
      const duration = Math.round((now - active.checkInTime) / (1000 * 60));

      active.checkOutTime = now;
      active.status = 'checked-out';
      active.duration = duration;
      await active.save();

      // release seat
      const seat = await Seat.findOne({
        bookedBy: student._id,
        status: { $in: ["booked", "occupied"] }
      });

      if (seat) {
        seat.status = "available";
        seat.bookedBy = null;
        seat.bookingStartTime = null;
        seat.bookingEndTime = null;
        seat.bookingDate = null;

        await seat.save();
      }

      return res.json({
        success: true,
        type: 'checkout',
        message: `${student.name} checked out`,
        duration,
        student: {
          name: student.name,
          scholarNumber: student.scholarNumber
        }
      });
    }

    // =========================
    // CASE 2 → CHECK IN
    // =========================
    const newRecord = await CheckIn.create({
      studentId: student._id,
      rfidCard,
      checkInTime: new Date(),
      status: 'checked-in'
    });

    // occupy reserved seat
    const seat = await Seat.findOne({
      bookedBy: student._id,
      status: "booked"
    });

    if (seat) {
      seat.status = "occupied";
      await seat.save();
    }

    return res.json({
      success: true,
      type: 'checkin',
      message: `${student.name} checked in`,
      student: {
        name: student.name,
        scholarNumber: student.scholarNumber
      },
      checkIn: newRecord
    });

  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

module.exports = {
  getAllCheckIns,
  checkInStudent,
  checkOutStudent,
  checkOutByRFID,
  getStudentCheckInHistory,
  tapRFID
};
