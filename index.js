const express = require('express');
const cors = require('cors');
const logger = require('morgan');
const passport = require("passport");
const session = require("express-session");
const cookieParser = require("cookie-parser");

// Configure dotenv for environment variables
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Import routers
const authRouter = require("./routes/authRouter");
const bookRouter = require("./routes/bookRouter");
const authorRouter = require("./routes/authorRouter");
const borrowalRouter = require("./routes/borrowalRouter");
const genreRouter = require("./routes/genreRouter");
const userRouter = require("./routes/userRouter");
const reviewRouter = require("./routes/reviewRouter");
const seatRouter = require("./routes/seatRouter");
const checkInRouter = require("./routes/checkInRouter");
const paymentRouter = require("./routes/paymentRouter");
const dashboardRouter = require("./routes/dashboardRouter");
const memberRouter = require("./routes/memberRouter");
const rfidRouter = require("./routes/rfidRouter");

const app = express();
const PORT = process.env.PORT || 8080;
const isProduction = process.env.NODE_ENV === "production";

// Logging
app.use(logger("dev"));

// Trust Nginx reverse proxy so secure cookies work on HTTPS.
app.set("trust proxy", 1);

// Body parsers
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('Connected to DB on MongoDB Atlas'))
  .catch((err) => console.log('DB connection error', err));

// CORS
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "https://studyadda.me",
      "https://www.studyadda.me"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Session
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      maxAge: 24 * 60 * 60 * 1000
    }
  })
);

// Cookie parser
app.use(cookieParser(process.env.SESSION_SECRET));

// Passport
app.use(passport.initialize());
app.use(passport.session());
const initializePassport = require("./passport-config");
initializePassport(passport);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/book", bookRouter);
app.use("/api/author", authorRouter);
app.use("/api/borrowal", borrowalRouter);
app.use("/api/genre", genreRouter);
app.use("/api/user", userRouter);
app.use("/api/review", reviewRouter);
app.use("/api/seat", seatRouter);
app.use("/api/checkin", checkInRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/member", memberRouter);
app.use("/api/rfid", rfidRouter);

app.get('/', (req, res) => res.send('StudyAdda Library Management API'));

app.listen(PORT, () => console.log(`Server listening on port ${PORT}!`));

const Seat = require('./models/seat');

setInterval(async () => {
  try {
    const now = new Date();

    await Seat.updateMany(
      {
        status: "booked",
        bookingEndTime: { $lt: now }
      },
      {
        $set: {
          status: "available",
          bookedBy: null,
          bookingStartTime: null,
          bookingEndTime: null,
          bookingDate: null
        }
      }
    );

  } catch (err) {
    console.log("Seat expire error:", err.message);
  }
}, 60000);
