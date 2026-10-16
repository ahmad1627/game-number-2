import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User, initModels } from "./models.js";
const email = (process.env.ADMIN_BOOTSTRAP_EMAIL || "").trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
if (
  !(process.env.ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .includes(email)
)
  throw new Error("ADMIN_BOOTSTRAP_EMAIL must be in ADMIN_EMAILS.");
if (!password || password.length < 12 || Buffer.byteLength(password) > 72)
  throw new Error("Use a unique admin password of 12–72 bytes.");
await mongoose.connect(process.env.MONGODB_URI);
await initModels();
try {
  if (await User.exists({ email }))
    throw new Error(
      "Account exists. This command will not overwrite its password.",
    );
  await User.create({
    email,
    name: "League organiser",
    password: await bcrypt.hash(password, 12),
  });
  console.log(
    "Organiser account created. Remove ADMIN_BOOTSTRAP_PASSWORD from your environment.",
  );
} finally {
  await mongoose.disconnect();
}
