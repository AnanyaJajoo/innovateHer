import mongoose from "mongoose";

export const connectDb = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI is not set. MongoDB caching disabled.");
    return false;
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`MongoDB connection failed (${message}). Caching disabled.`);
    return false;
  }
};

export const isDbReady = () => mongoose.connection.readyState === 1;
