import mongoose from "mongoose";

const hoursSchema = new mongoose.Schema(
  { from: { type: String, default: "08:00" }, to: { type: String, default: "20:00" } },
  { _id: false }
);

const providerSchema = new mongoose.Schema(
  {
    businessName: { type: String, default: "" },
    category: { type: String, default: "" },
    services: { type: [mongoose.Schema.Types.Mixed], default: [] },
    serviceAreas: { type: [String], default: [] },
    hours: { type: hoursSchema, default: () => ({}) },
    description: { type: String, default: "" },
    experience: { type: String, default: "" },
    verified: { type: Boolean, default: false },
    available: { type: Boolean, default: true },
    startingPrice: { type: Number, default: 399 },
    responseTime: { type: String, default: "~30 mins" },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    completedJobs: { type: Number, default: 0 },
    location: { type: String, default: "" },
    website: { type: String, default: "" },
    photos: { type: [String], default: [] },
    coverPhoto: { type: String, default: "" },
    gstCertificate: { type: String, default: "" },
    aadhaarCard: { type: String, default: "" },
    panCard: { type: String, default: "" },
    documents: {
      type: [
        {
          name: { type: String, default: "" },
          url: { type: String, default: "" },
        },
      ],
      default: [],
    },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    onboarded: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, index: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true, select: false },
    googleId: { type: String, default: "", index: true },
    role: {
      type: String,
      enum: ["customer", "worker", "business", "admin", "provider"],
      required: true,
      index: true,
    },
    avatar: { type: String, default: "" },
    city: { type: String, default: "" },
    area: { type: String, default: "" },
    address: { type: String, default: "" },
    age: { type: Number, default: null },
    jobType: { type: String, default: "" },
    studies: { type: String, default: "" },
    aadhaar: { type: String, default: "" },
    pan: { type: String, default: "" },
    lang: { type: String, enum: ["en", "ta"], default: "en" },
    profileAsked: { type: Boolean, default: false },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    userCode: { type: String, unique: true, sparse: true, index: true },
    walletBalance: { type: Number, default: 0 },
    license: {
      key: { type: String, default: "" },
      plan: { type: String, default: "none" },
      days: { type: Number, default: 0 },
      startsAt: { type: Date, default: null },
      expiresAt: { type: Date, default: null },
      status: { type: String, enum: ["none", "pending", "active", "expired", "revoked"], default: "none" },
      grantedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    provider: { type: providerSchema, default: undefined },
  },
  { timestamps: true }
);

userSchema.index({ "provider.category": 1, "provider.available": 1, status: 1 });
userSchema.index({ city: 1, role: 1 });
userSchema.index({ email: 1, role: 1 }, { unique: true });

export const User = mongoose.model("User", userSchema);
