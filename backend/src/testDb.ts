import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDb } from "./db.js";

dotenv.config();

// Define a simple test schema and model
const testSchema = new mongoose.Schema({
  message: String,
  timestamp: Date,
  testNumber: Number,
});

const TestModel = mongoose.model("Test", testSchema);

const testConnection = async () => {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await connectDb();
    console.log("✅ Successfully connected to MongoDB!");

    // Write sample data
    console.log("\n📝 Writing sample data...");
    const sampleData = new TestModel({
      message: "Hello from InnovateHer MongoDB test!",
      timestamp: new Date(),
      testNumber: Math.floor(Math.random() * 1000),
    });

    const savedData = await sampleData.save();
    console.log("✅ Sample data written successfully!");
    console.log("📊 Data saved:", JSON.stringify(savedData, null, 2));

    // Read back the data to verify
    console.log("\n🔍 Reading data back from database...");
    const allTestData = await TestModel.find();
    console.log(`✅ Found ${allTestData.length} test record(s) in database`);
    console.log("📊 All test data:", JSON.stringify(allTestData, null, 2));

    // Clean up - optionally delete the test data
    console.log("\n🧹 Cleaning up test data...");
    await TestModel.deleteMany({});
    console.log("✅ Test data cleaned up!");

    // Close connection
    await mongoose.connection.close();
    console.log("\n👋 Connection closed. Test completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during database test:", error);
    process.exit(1);
  }
};

testConnection();
