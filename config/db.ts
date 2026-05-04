import mongoose from "mongoose";

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/product-hunt";
    
    await mongoose.connect(mongoURI);
    console.log(`Connected to Database: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;