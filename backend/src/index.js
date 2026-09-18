import { createApp } from "./app.js";
import { env, logStartupConfig } from "./config/env.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { ensureProductionAccounts } from "./utils/ensureAdmin.js";
import { ensureCanonicalCategories } from "./utils/categories.js";
import { startCron } from "./jobs/cron.js";
import { User } from "./models/User.js";
import { Conversation } from "./models/Conversation.js";
import { Request } from "./models/Request.js";
import { WorkerLock } from "./models/WorkerLock.js";
import { LedgerEntry } from "./models/LedgerEntry.js";
import { Session } from "./models/Session.js";
import { Cancellation } from "./models/Cancellation.js";

const app = createApp();

connectDb()
  .then(async () => {
    await ensureProductionAccounts();
    await ensureCanonicalCategories();
    app.listen(env.port, "0.0.0.0", () => {
      console.log(`Fixbuddy API on http://localhost:${env.port}`);
      console.log("MongoDB connected");
      logStartupConfig();
      startCron();
    });
    User.syncIndexes().catch((err) => console.error("User index sync:", err.message));
    Conversation.syncIndexes().catch((err) => console.error("Conversation index sync:", err.message));
    Request.syncIndexes().catch((err) =>
      console.error("Request index sync:", err.message, "(one_engaged_job_per_provider needs at most one engaged job per worker)"),
    );
    WorkerLock.syncIndexes().catch((err) => console.error("WorkerLock index sync:", err.message));
    LedgerEntry.syncIndexes().catch((err) => console.error("LedgerEntry index sync:", err.message));
    Session.syncIndexes().catch((err) => console.error("Session index sync:", err.message));
    Cancellation.syncIndexes().catch((err) => console.error("Cancellation index sync:", err.message));
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Start MongoDB then retry.");
    process.exit(1);
  });

async function shutdown() {
  await disconnectDb();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
