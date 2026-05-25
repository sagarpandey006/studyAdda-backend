// Seed script to initialize seats in the database
// Run this file with: node seedSeats.js

require('dotenv').config();
const mongoose = require('mongoose');
const Seat = require('./models/seat');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('Connected to MongoDB');
    seedSeats();
  })
  .catch((err) => {
    console.log('DB connection error:', err);
    process.exit(1);
  });

async function seedSeats() {
  try {
    // Check if seats already exist
    const existingSeats = await Seat.countDocuments();
    if (existingSeats > 0) {
      console.log(`Database already contains ${existingSeats} seats. Skipping seed.`);
      console.log('To re-seed, first delete all seats from the database.');
      process.exit(0);
    }

    const seats = [];
    const sections = ['A', 'B', 'C', 'D'];
    const floors = [1, 2, 3];
    const seatsPerSection = 15;

    console.log('Generating seats...');

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

    console.log(`Inserting ${seats.length} seats into database...`);
    await Seat.insertMany(seats);

    console.log('✅ Successfully seeded seats!');
    console.log(`Total seats created: ${seats.length}`);
    console.log('Breakdown:');
    console.log(`- Floors: ${floors.length}`);
    console.log(`- Sections per floor: ${sections.length}`);
    console.log(`- Seats per section: ${seatsPerSection}`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding seats:', error);
    process.exit(1);
  }
}
