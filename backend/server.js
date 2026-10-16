import "dotenv/config";
import mongoose from "mongoose";
import { createApp } from "./app.js";
import { initModels } from "./models.js";
import { seedData } from "./seed.js";

if (
  !process.env.JWT_SECRET ||
  process.env.JWT_SECRET.length < 32 ||
  process.env.JWT_SECRET.startsWith("replace-this")
) {
  process.env.JWT_SECRET = "3404c0f8adf059dad378808adf3629f83cfbbd1445f165260ec9775b48503cf8";
}

let mongod = null;
let mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fantasy_xi_v2";

mongoose.set("bufferCommands", false);

try {
  console.log(`[Database] Connecting to MongoDB at ${mongoUri}...`);
  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 2000,
    maxPoolSize: 20,
  });
  console.log("[Database] Connected successfully to:", mongoUri);
} catch (err) {
  console.warn(`[Database] Local/Configured MongoDB connection failed (${err.message}).`);
  console.log("[Database] Starting embedded in-memory MongoDB for instant zero-configuration run...");
  try {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    await mongoose.connect(mongoUri);
    console.log("[Database] Embedded in-memory MongoDB connected successfully!");
  } catch (memErr) {
    console.error("[Database] Failed to start in-memory MongoDB:", memErr.message);
    throw err;
  }
}

await initModels();

try {
  await seedData();
  console.log("[Database] Practice players and matches initialized.");
} catch (seedErr) {
  console.warn("[Database] Seeder notice:", seedErr.message);
}

const PORT = process.env.PORT || 5000;
const server = createApp().listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`  Fantasy XI Server running on http://localhost:${PORT}`);
  console.log(`====================================================`);
});

async function shutdown() {
  server.close(async () => {
    await mongoose.disconnect();
    if (mongod) await mongod.stop();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
