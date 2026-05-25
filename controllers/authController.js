const User = require('../models/user')
const passport = require("passport");

const crypto = require("crypto");
const nodemailer = require("nodemailer");

const registerUser = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (user) {
      return res.status(403).json({ success: false, message: "User already exists" });
    }

    const newUser = new User(req.body);
    newUser.setPassword(req.body.password);
    const savedUser = await newUser.save();

    return res.status(201).json({
      success: true,
      user: savedUser
    });
  } catch (err) {
    return res.status(400).json({ success: false, err });
  }
}

const loginUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.salt || !user.hash) {
      return res.status(401).json({ success: false, message: "User password not set. Please contact administrator." });
    }

    if (!user.isValidPassword(req.body.password)) {
      return res.status(401).json({ success: false, message: "Password incorrect" });
    }

    passport.authenticate("local", (err, user, info) => {
      req.logIn(user, (err) => {
        if (err) {
          throw err;
        }
        return res.status(200).json({
          success: true,
          user
        });
      });
    })(req, res, next);
  } catch (err) {
    return res.status(500).json({ success: false, err });
  }
}

const forgotPassword = async (req, res) => {
  try {

    const user = await User.findOne({ email: req.body.email })

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    const token = crypto.randomBytes(32).toString("hex")

    user.resetPasswordToken = token
    user.resetPasswordExpires = Date.now() + 3600000

    await user.save()

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
      }
    })

    const resetLink = `https://studyadda.me/resetpassword/${token}`

    await transporter.sendMail({
      to: user.email,
      subject: "Password Reset",
      html: `<p>Click below to reset password</p>
            <a href="${resetLink}">${resetLink}</a>`
    })

    res.json({ success: true, message: "Reset link sent to email" })

  } catch (err) {
    res.status(500).json({ success: false, err })
  }
}

const resetPassword = async (req, res) => {
  try {

    const user = await User.findOne({
      // resetPasswordToken:req.body.token,
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid token" })
    }

    user.setPassword(req.body.password)

    user.resetPasswordToken = undefined
    user.resetPasswordExpires = undefined

    await user.save()

    res.json({ success: true, message: "Password updated" })

  } catch (err) {
    res.status(500).json({ success: false, err })
  }
}

const logoutUser = async (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    // res.redirect('/login');
  });
  return res.status(200).json({ success: true, message: "User logged out" });
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword
}
