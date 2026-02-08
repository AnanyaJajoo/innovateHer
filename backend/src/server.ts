import dotenv from "dotenv";
import { createApp } from "./app";
import { connectDb } from "./db";

dotenv.config();

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const host = process.env.HOST ?? "127.0.0.1";

const start = async () => {
  await connectDb();
  const app = createApp();
  app.listen(port, host, () => {
    console.log(`API ready at http://${host}:${port}`);
  });
};

start().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
