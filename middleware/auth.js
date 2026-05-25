// Middleware to check if user is logged
const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized. Please login first.' });
};

// Middleware to check if logged in user is admin
const isAdmin = (req, res, next) => {
  if (req.isAuthenticated() && req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
};

// Middleware to check if logged in user is a member (non-admin student)
const isMember = (req, res, next) => {
  if (req.isAuthenticated() && !req.user.isAdmin) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Forbidden. Member access only.' });
};

module.exports = { isAuthenticated, isAdmin, isMember };
