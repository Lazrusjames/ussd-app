// dbTest.js
import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const testConnection = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.error("Error: MONGO_URI is missing from your .env file.");
    process.exit(1);
  }

  // Monitor connection lifecycle events
  mongoose.connection.on('connected', () => {
    console.log('✅ Success: Mongoose successfully connected to MongoDB Atlas!');
  });

  mongoose.connection.on('error', (err) => {
    console.error(`❌ Connection Event Error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected from Atlas.');
  });

  try {
    console.log('Connecting to MongoDB Atlas...');
    // Establish connection
    await mongoose.connect(uri);
    
    // Gracefully close connection after successful confirmation text logs
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error(`❌ Initial Connection Failure: ${error.message}`);
    process.exit(1);
  }
};

testConnection();