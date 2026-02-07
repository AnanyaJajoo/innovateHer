import dotenv from "dotenv";
import { createApp } from "./app.js";
import { connectDb } from "./db.js";

dotenv.config();

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

const start = async () => {
  await connectDb();
  const app = createApp();
  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
