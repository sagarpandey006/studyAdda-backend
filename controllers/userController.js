const User = require('../models/user');

// Get single user
const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-hash -salt -resetPasswordToken -resetPasswordExpires');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-hash -salt -resetPasswordToken -resetPasswordExpires').sort({ createdAt: -1 });
    return res.status(200).json({ success: true, usersList: users });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get all members (non-admin users)
const getAllMembers = async (req, res) => {
  try {
    const members = await User.find({ isAdmin: false })
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, membersList: members });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Add user (admin creates a user/student)
const addUser = async (req, res) => {
  try {
    const existing = await User.findOne({ email: req.body.email });
    if (existing) {
      return res.status(403).json({ success: false, message: 'User already exists with this email' });
    }

    const newUser = new User(req.body);
    newUser.setPassword(req.body.password);
    const saved = await newUser.save();

    const userObj = saved.toObject();
    delete userObj.hash;
    delete userObj.salt;

    return res.status(201).json({ success: true, user: userObj });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Update user (only re-hash password if password field is provided)
const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const updates = { ...req.body };

    // If password is provided, hash it; otherwise remove password field from update
    if (updates.password && updates.password.trim() !== '') {
      const tempUser = new User();
      tempUser.setPassword(updates.password);
      updates.hash = tempUser.hash;
      updates.salt = tempUser.salt;
    }
    delete updates.password;

    const updated = await User.findByIdAndUpdate(userId, updates, { new: true })
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires');

    if (!updated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, updatedUser: updated });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, deletedUser: deleted });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Block a student
const blockStudent = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Block reason is required' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'Blocked', blockReason: reason },
      { new: true }
    ).select('-hash -salt');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user, message: 'Student blocked successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Unblock a student
const unblockStudent = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: 'Active', blockReason: null },
      { new: true }
    ).select('-hash -salt');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.status(200).json({ success: true, user, message: 'Student unblocked successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Search student by scholar number
const getStudentByScholarNumber = async (req, res) => {
  try {
    const student = await User.findOne({ scholarNumber: req.params.scholarNumber, isAdmin: false })
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    return res.status(200).json({ success: true, student });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Search student by enrollment number
const getStudentByEnrollmentNumber = async (req, res) => {
  try {
    const student = await User.findOne({ enrollmentNumber: req.params.enrollmentNumber, isAdmin: false })
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }
    return res.status(200).json({ success: true, student });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Search student by RFID card
const getStudentByRFID = async (req, res) => {
  try {
    const student = await User.findOne({ rfidCard: req.params.rfidCard, isAdmin: false })
      .select('-hash -salt -resetPasswordToken -resetPasswordExpires');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found with this RFID card' });
    }
    return res.status(200).json({ success: true, student });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

// Get logged-in user's own profile
const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-hash -salt -resetPasswordToken -resetPasswordExpires');
    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, err: err.message });
  }
};

module.exports = {
  getUser,
  getAllUsers,
  getAllMembers,
  addUser,
  updateUser,
  deleteUser,
  blockStudent,
  unblockStudent,
  getStudentByScholarNumber,
  getStudentByEnrollmentNumber,
  getStudentByRFID,
  getMyProfile
};
