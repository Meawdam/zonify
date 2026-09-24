import mongoose from "mongoose";

export const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is not defined");
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    throw new Error("Cannot connect to MongoDB", {
      cause: error,
    });
  }
};