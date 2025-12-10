import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Explicitly load .env here to ensure it's available
dotenv.config();

const connectDB = async () => {
  try {
    // Debug log to check if URI is loaded
    console.log("Attempting to connect to:", process.env.MONGO_URI);

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is undefined in .env file");
    }

    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;