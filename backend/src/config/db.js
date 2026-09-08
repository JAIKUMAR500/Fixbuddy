import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000,
  });
  return mongoose.connection;
}
