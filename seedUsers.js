// Script to seed test users into the database
const mongoose = require('mongoose');
const User = require('./models/user');

// Configure dotenv for environment variables
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

// Connect to DB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('Connected to DB on MongoDB Atlas');
    seedUsers();
  })
  .catch((err) => {
    console.log('DB connection error', err);
    process.exit(1);
  });

async function seedUsers() {
  try {
    // Test user data
    const testUsers = [
      {
        name: "Admin Librarian",
        email: "librarian@library.com",
        dob: new Date("1990-01-15"),
        phone: "+1234567890",
        isAdmin: true,
        photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=librarian",
        password: "librarian123"
      },
      {
        name: "John Member",
        email: "member@library.com",
        dob: new Date("1995-06-20"),
        phone: "+0987654321",
        isAdmin: false,
        photoUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=member",
        password: "member123"
      }
    ];

    console.log('\n🚀 Starting to seed users...\n');

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ email: userData.email });
      
      if (existingUser) {
        console.log(`⚠️  User ${userData.email} already exists. Updating password...`);
        existingUser.setPassword(userData.password);
        await existingUser.save();
        console.log(`✅ Updated user: ${userData.name} (${userData.email})`);
      } else {
        const newUser = new User({
          name: userData.name,
          email: userData.email,
          dob: userData.dob,
          phone: userData.phone,
          isAdmin: userData.isAdmin,
          photoUrl: userData.photoUrl
        });
        
        newUser.setPassword(userData.password);
        await newUser.save();
        console.log(`✅ Created user: ${userData.name} (${userData.email})`);
      }
    }

    console.log('\n✨ User seeding completed!\n');
    console.log('📋 Test Users Created:\n');
    console.log('1. Librarian (Admin):');
    console.log('   Email: librarian@library.com');
    console.log('   Password: librarian123\n');
    console.log('2. Member:');
    console.log('   Email: member@library.com');
    console.log('   Password: member123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
}
