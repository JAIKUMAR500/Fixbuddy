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
import { cacheGet, cacheSet } from "./utils/cache.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = new Set(
  [
    "https://fixbuddy-ivory.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
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
  const cached = cacheGet("public:config");
  if (cached) return res.json(cached);
  const { getSettings } = await import("./models/PlatformSettings.js");
  const settings = await getSettings();
  const payload = {
    supportEmail: settings.supportEmail || env.supportEmail,
    googleClientId: settings.googleClientId || env.googleClientId || "",
  };
  cacheSet("public:config", payload, 60_000);
  res.json(payload);
});

app.get("/api/public/stats", async (_req, res) => {
  const cached = cacheGet("public:stats");
  if (cached) return res.json(cached);
  const [customers, businesses, workers, categories, rating] = await Promise.all([
    User.countDocuments({ role: "customer", status: "active" }),
    User.countDocuments({ role: { $in: ["business", "provider"] }, status: "active" }),
    User.countDocuments({ role: "worker", status: "active" }),
    Category.countDocuments({ active: true }),
    Review.aggregate([{ $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }]),
  ]);
  const payload = {
    customers,
    businesses,
    workers,
    categories,
    ratingAvg: rating[0] ? Math.round((rating[0].avg || 0) * 10) / 10 : 0,
    ratingCount: rating[0]?.count || 0,
  };
  cacheSet("public:stats", payload, 60_000);
  res.json(payload);
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
    await ensureProductionAccounts();
    app.listen(env.port, () => {
      console.log(`Fixbuddy API on http://localhost:${env.port}`);
      console.log("MongoDB connected");
      startCron();
    });
    User.syncIndexes().catch((err) => console.error("User index sync:", err.message));
    Conversation.syncIndexes().catch((err) => console.error("Conversation index sync:", err.message));
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
