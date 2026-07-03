import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// 1. Define the Schema for your "users" collection
const userSchema = new mongoose.Schema({
  phoneNumber: { type: String, required: true },
  fullName: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// 2. Create the Model
// Mongoose automatically looks for the plural, lowercase version of the model name.
// "User" will automatically map to the "users" collection.
const User = mongoose.model('User', userSchema);

const runTest = async () => {
  try {
    console.log('⏳ Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('🟢 Connected successfully!');

    // --- TEST 1: WRITE DATA ---
    console.log('✍️ Attempting to write a test user to the "users" collection...');
    const testUser = new User({
      phoneNumber: '+265888123456',
      fullName: 'Lazarus Mphande'
    });
    
    const savedUser = await testUser.save();
    console.log('✅ Write Successful! Saved Document:', savedUser);

    // --- TEST 2: READ DATA ---
    console.log('📖 Attempting to read the data back from the database...');
    const foundUser = await User.findOne({ phoneNumber: '+265888123456' });
    
    if (foundUser) {
      console.log('✅ Read Successful! Found User in DB:', foundUser.fullName);
    } else {
      console.log('❌ Read Failed: User could not be found.');
    }

    // --- OPTIONAL CLEANUP ---
    // Clean up the test data so your database stays clean
    await User.deleteOne({ _id: savedUser._id });
    console.log('🧹 Cleaned up test document.');

  } catch (error) {
    console.error('🔴 Database Test Failed!');
    console.error('Error Details:', error.message);
  } finally {
    // Always close the connection when the script finishes running
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB Atlas.');
  }
};

runTest();