import mongoose from "mongoose";

const timelineSchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    note: { type: String, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const matchSchema = new mongoose.Schema(
  {
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    score: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    distance: { type: String, default: "" },
  },
  { _id: false }
);

const requestSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    postedByRole: { type: String, enum: ["customer", "business", "admin"], default: "customer", index: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    address: { type: String, default: "" },
    area: { type: String, default: "" },
    city: { type: String, default: "Bengaluru" },
    landmark: { type: String, default: "" },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    workerLat: { type: Number, default: null },
    workerLng: { type: Number, default: null },
    workerLocationAt: { type: Date, default: null },
    arrivedAt: { type: Date, default: null },
    jobOtp: { type: String, default: "" },
    jobOtpExpiresAt: { type: Date, default: null },
    jobOtpAttempts: { type: Number, default: 0 },
    jobOtpLockedUntil: { type: Date, default: null },
    otpVerified: { type: Boolean, default: false },
    otpVerifiedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    paymentStatus: { type: String, enum: ["unpaid", "collected"], default: "unpaid", index: true },
    paymentCollectedAt: { type: Date, default: null },
    customerCompleted: { type: Boolean, default: false },
    customerCompletedAt: { type: Date, default: null },
    photos: { type: [String], default: [] },
    voiceNote: { type: String, default: "" },
    timing: { type: String, default: "asap" },
    scheduledAt: { type: Date, default: null },
    scheduledLabel: { type: String, default: "" },
    budgetMin: { type: Number, default: 300 },
    budgetMax: { type: Number, default: 800 },
    estimatedAmount: { type: Number, default: 0 },
    workerQuote: { type: Number, default: null },
    tags: { type: [String], default: [] },
    publicPost: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "matching",
        "open",
        "requested",
        "accepted",
        "scheduled",
        "on_the_way",
        "arrived",
        "otp_verified",
        "in_progress",
        "completed",
        "payment_collected",
        "customer_completed",
        "reviewed",
        "cancelled",
        "declined",
      ],
      default: "matching",
      index: true,
    },
    timeline: { type: [timelineSchema], default: [] },
    matches: { type: [matchSchema], default: [] },
    invitedProviderIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    declinedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    crewId: { type: mongoose.Schema.Types.ObjectId, ref: "Crew", default: null, index: true },
    crewMemberIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    workersRequired: { type: Number, default: 1 },
    cancelReason: { type: String, default: "" },
    travelCompensation: { type: Number, default: 0 },
    acceptedAt: { type: Date, default: null },
    customerLanguage: { type: String, default: "en" },
    workerLanguage: { type: String, default: "en" },
    translatedDescription: { type: String, default: "" },
    /** Legacy: string URL. Current: { url, uploadedBy, uploadedAt, caption }. Both accepted. */
    workPhotos: {
      before: { type: [mongoose.Schema.Types.Mixed], default: [] },
      during: { type: [mongoose.Schema.Types.Mixed], default: [] },
      after: { type: [mongoose.Schema.Types.Mixed], default: [] },
    },
    /** How the worker was attached: solo accept, crew, or business team assign. */
    assignmentMode: {
      type: String,
      enum: ["solo", "crew", "business_team", "invite", ""],
      default: "",
    },
    watchToken: { type: String, default: "", index: true },
    watchTokenExpiresAt: { type: Date, default: null },
    tower: { type: String, default: "" },
    flat: { type: String, default: "" },
    gateNote: { type: String, default: "" },
    visitorName: { type: String, default: "" },
    delayReason: { type: String, default: "" },
    delayNote: { type: String, default: "" },
    preferredProviderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    pinCode: { type: String, default: "" },
    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: String, default: "" },
    finance: {
      mode: { type: String, default: "development" },
      status: {
        type: String,
        enum: ["not_applicable", "pending_simulation", "simulated", "cancelled", "refunded_simulation"],
        default: "not_applicable",
      },
      jobPricePaise: { type: Number, default: 0, min: 0 },
      commissionPercent: { type: Number, default: 0, min: 0 },
      commissionPaise: { type: Number, default: 0, min: 0 },
      workerGrossPaise: { type: Number, default: 0, min: 0 },
      workerNetPaise: { type: Number, default: 0, min: 0 },
      calculatedAt: { type: Date, default: null },
      settled: { type: Boolean, default: false },
      walletCredited: { type: Boolean, default: false },
      settlementRef: { type: String, default: "" },
    },
    cancellationFinance: {
      recorded: { type: Boolean, default: false },
      reason: { type: String, default: "" },
      cancelledBy: { type: String, default: "" },
      cancelledAt: { type: Date, default: null },
      amountPaise: { type: Number, default: 0, min: 0 },
      amountRupees: { type: Number, default: 0, min: 0 },
      payer: { type: String, default: null },
      receiver: { type: String, default: null },
      financialStatus: { type: String, default: "not_applicable" },
      scenario: { type: String, default: "" },
      financialMode: { type: String, default: "development" },
      label: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

requestSchema.index({ status: 1, category: 1, city: 1, createdAt: -1 });
requestSchema.index({ customerId: 1, createdAt: -1 });
requestSchema.index({ providerId: 1, status: 1, createdAt: -1 });
requestSchema.index({ pinCode: 1, category: 1, city: 1, paymentStatus: 1 });
requestSchema.index({ watchToken: 1, watchTokenExpiresAt: 1 });
/** Belt-and-suspenders: a providerId may appear on at most one engaged job. WorkerLock is the primary worker-side lock. */
requestSchema.index(
  { providerId: 1 },
  {
    unique: true,
    name: "one_engaged_job_per_provider",
    partialFilterExpression: {
      providerId: { $type: "objectId" },
      status: { $in: ["accepted", "scheduled", "on_the_way", "arrived", "otp_verified", "in_progress", "completed"] },
    },
  }
);

export const Request = mongoose.model("Request", requestSchema);
