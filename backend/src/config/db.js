import mongoose from "mongoose";
import { env } from "./env.js";

let listenersAttached = false;

function attachDbListeners() {
  if (listenersAttached) return;
  listenersAttached = true;
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB error:", err?.message || "connection error");
  });
  mongoose.connection.on("disconnected", () => {
    console.error("MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    console.log("MongoDB reconnected");
  });
}

export async function connectDb() {
  mongoose.set("strictQuery", true);
  attachDbListeners();
  await mongoose.connect(env.mongoUri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 8000,
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  if (mongoose.connection.readyState) {
    await mongoose.disconnect();
  }
}
