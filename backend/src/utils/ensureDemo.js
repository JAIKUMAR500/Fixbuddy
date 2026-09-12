import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { buildLicense, nextUserCode } from "./license.js";

const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "";

const DEMOS = [
  {
    email: "customer@fixbuddy.com",
    name: "Rahul Mehta",
    role: "customer",
    phone: "+91 98765 43210",
    city: "Bengaluru",
    area: "Koramangala",
  },
  {
    email: "worker@fixbuddy.com",
    name: "Rakesh Kumar",
    role: "worker",
    phone: "+91 98765 22000",
    city: "Bengaluru",
    area: "HSR Layout",
    provider: {
      businessName: "Rakesh Kumar",
      category: "AC Repair & Service",
      services: ["AC Repair", "AC Service"],
      serviceAreas: ["HSR Layout", "Koramangala", "Bengaluru"],
      verified: true,
      available: true,
      onboarded: true,
      startingPrice: 349,
      ratingAvg: 4.8,
      ratingCount: 18,
      completedJobs: 126,
      location: "HSR Layout, Bengaluru",
    },
  },
  {
    email: "provider@fixbuddy.com",
    name: "CoolAir Solutions",
    role: "business",
    phone: "+91 98765 55000",
    city: "Bengaluru",
    area: "Koramangala",
    provider: {
      businessName: "CoolAir Solutions",
      category: "AC Repair & Service",
      services: ["AC Installation", "AC Repair", "AC Service"],
      serviceAreas: ["Koramangala", "HSR Layout", "Bengaluru"],
      verified: true,
      available: true,
      onboarded: true,
      startingPrice: 399,
      ratingAvg: 4.9,
      ratingCount: 3,
      completedJobs: 847,
      location: "Koramangala, Bengaluru",
    },
  },
];

export async function ensureDemoAccounts() {
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_DEMO_ACCOUNTS !== "true" || !DEMO_PASSWORD) return;
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const demo of DEMOS) {
    const existing = await User.findOne({ email: demo.email }).lean();
    const userCode = existing?.userCode || (await nextUserCode(demo.role));
    const license =
      existing?.license?.status === "active"
        ? existing.license
        : buildLicense({ days: 365, plan: demo.role === "admin" ? "admin" : "pro" });
    await User.findOneAndUpdate(
      { email: demo.email },
      { $set: { ...demo, passwordHash, status: "active", userCode, license, profileAsked: true } },
      { upsert: true, new: true }
    );
  }
  console.log("Development demo accounts are ready.");
  console.log("  customer@fixbuddy.com  → Customer");
  console.log("  worker@fixbuddy.com    → Worker");
  console.log("  provider@fixbuddy.com  → Business");
}
