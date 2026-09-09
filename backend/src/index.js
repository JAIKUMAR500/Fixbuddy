import express from "express";
import cors from "cors";
import morgan from "morgan";
import mongoose from "mongoose";
import { User } from "./models/User.js";
import { Category } from "./models/Category.js";
import { Review } from "./models/Review.js";
import { Conversation } from "./models/Conversation.js";
import { env } from "./config/env.js";
import { connectDb } from "./config/db.js";
import { ensureProductionAccounts } from "./utils/ensureAdmin.js";
import { auth } from "./middleware/auth.js";
import { errorHandler, notFound } from "./middleware/error.js";
import authRoutes from "./routes/auth.js";
import providerRoutes from "./routes/providers.js";
import requestRoutes from "./routes/requests.js";
import chatRoutes from "./routes/chat.js";
import notificationRoutes from "./routes/notifications.js";
import reviewRoutes from "./routes/reviews.js";
import adminRoutes from "./routes/admin.js";
import statsRoutes from "./routes/stats.js";
import categoryRoutes from "./routes/categories.js";
import uploadRoutes, { uploadDir } from "./routes/upload.js";
import teamRoutes from "./routes/team.js";
import { startCron } from "./jobs/cron.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = new Set(
  [
    "https://fixbuddy-ivory.vercel.app",
    "http://localhost:5173",
    "http://localhost:8443",
    ...String(env.clientOrigin)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  ].map((s) => s.replace(/\/$/, "")),
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin || allowedOrigins.has(origin.replace(/\/$/, ""))) {
        return cb(null, true);
      }
      cb(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "12mb" }));
app.use(morgan("tiny"));
app.use("/api/uploads", express.static(uploadDir));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "fixbuddy-api" });
});

app.get("/api/public/config", async (_req, res) => {
  const { getSettings } = await import("./models/PlatformSettings.js");
  const settings = await getSettings();
  res.json({
    supportEmail: settings.supportEmail || env.supportEmail,
    googleClientId: settings.googleClientId || env.googleClientId || "",
  });
});

app.get("/api/public/stats", async (_req, res) => {
  const [customers, businesses, workers, categories, reviews] = await Promise.all([
    User.countDocuments({ role: "customer", status: "active" }),
    User.countDocuments({ role: { $in: ["business", "provider"] }, status: "active" }),
    User.countDocuments({ role: "worker", status: "active" }),
    Category.countDocuments({ active: true }),
    Review.find().select("rating").lean(),
  ]);
  const ratingAvg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length) * 10) / 10
    : 0;
  res.json({
    customers,
    businesses,
    workers,
    categories,
    ratingAvg,
    ratingCount: reviews.length,
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/providers", auth, providerRoutes);
app.use("/api/requests", auth, requestRoutes);
app.use("/api/conversations", auth, chatRoutes);
app.use("/api/notifications", auth, notificationRoutes);
app.use("/api/reviews", auth, reviewRoutes);
app.use("/api/admin", auth, adminRoutes);
app.use("/api/stats", auth, statsRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/upload", auth, uploadRoutes);
app.use("/api/team", auth, teamRoutes);

app.use(notFound);
app.use(errorHandler);

connectDb()
  .then(async () => {
    await User.syncIndexes();
    await Conversation.syncIndexes();
    await ensureProductionAccounts();
    app.listen(env.port, () => {
      console.log(`Fixbuddy API on http://localhost:${env.port}`);
      console.log("MongoDB connected");
      startCron();
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Start MongoDB on localhost:27017 then retry.");
    process.exit(1);
  });

process.on("SIGINT", async () => {
  await mongoose.disconnect();
  process.exit(0);
});
