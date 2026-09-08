import bcrypt from "bcryptjs";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { User } from "./models/User.js";
import { Request } from "./models/Request.js";
import { Conversation } from "./models/Conversation.js";
import { Message } from "./models/Message.js";
import { Notification } from "./models/Notification.js";
import { Review } from "./models/Review.js";
import { Category } from "./models/Category.js";
import { Complaint } from "./models/Complaint.js";
import { Transaction } from "./models/Transaction.js";
import { AuditLog } from "./models/AuditLog.js";
import { PlatformSettings } from "./models/PlatformSettings.js";
import { buildLicense } from "./utils/license.js";

const AV = {
  rahul: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&auto=format",
  priya: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=80&h=80&fit=crop&auto=format",
  cool: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&auto=format",
  frost: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&auto=format",
  arctic: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=80&h=80&fit=crop&auto=format",
  tech: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&auto=format",
  anita: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=80&h=80&fit=crop&auto=format",
  karthik: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=80&h=80&fit=crop&auto=format",
  doc: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=400&h=280&fit=crop&auto=format",
};

async function run() {
  await connectDb();
  console.log("Seeding", env.mongoUri);

  await Promise.all([
    User.deleteMany({}),
    Request.deleteMany({}),
    Conversation.deleteMany({}),
    Message.deleteMany({}),
    Notification.deleteMany({}),
    Review.deleteMany({}),
    Category.deleteMany({}),
    Complaint.deleteMany({}),
    Transaction.deleteMany({}),
    AuditLog.deleteMany({}),
    PlatformSettings.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash("password123", 10);

  await Category.insertMany([
    { name: "AC Repair & Service", icon: "❄️", description: "Split, window and cassette AC service", services: [{ name: "AC Service", priceFrom: 399 }, { name: "Gas Refill", priceFrom: 1499 }] },
    { name: "Electrical Work", icon: "⚡", description: "Wiring, switches and inverter work", services: [{ name: "Switch repair", priceFrom: 199 }] },
    { name: "Plumbing", icon: "🚿", description: "Leaks, taps and bathroom fittings", services: [{ name: "Leak fix", priceFrom: 249 }] },
    { name: "Home Appliance Repair", icon: "🔧", description: "Fridge, washing machine, microwave", services: [{ name: "Washing machine", priceFrom: 349 }] },
    { name: "Laptop/Mobile Repair", icon: "💻", description: "Screens, batteries and data recovery", services: [{ name: "Screen replace", priceFrom: 999 }] },
    { name: "Cleaning", icon: "✨", description: "Home and office deep cleaning", services: [{ name: "Home cleaning", priceFrom: 799 }] },
    { name: "PC Repair", icon: "🖥️", description: "Desktop and workstation repair", services: [{ name: "PC diagnosis", priceFrom: 299 }] },
  ]);

  const admin = await User.create({
    name: "Fixbuddy Admin",
    email: "admin@fixbuddy.com",
    phone: "+91 90000 00000",
    passwordHash,
    role: "admin",
    city: "Coimbatore",
  });

  await User.create({
    name: "Ops Manager",
    email: "ops@fixbuddy.com",
    phone: "+91 90000 00001",
    passwordHash,
    role: "admin",
    city: "Coimbatore",
    status: "active",
  });

  const customer = await User.create({
    name: "Rahul Mehta",
    email: "customer@fixbuddy.com",
    phone: "+91 98765 43210",
    passwordHash,
    role: "customer",
    avatar: AV.rahul,
    city: "Coimbatore",
    area: "RS Puram",
    address: "12A Avinashi Road Apartments, RS Puram",
    lat: 11.0168,
    lng: 76.9558,
  });

  const priya = await User.create({
    name: "Priya Sharma",
    email: "priya@fixbuddy.com",
    phone: "+91 98765 11111",
    passwordHash,
    role: "customer",
    avatar: AV.priya,
    city: "Coimbatore",
    area: "Peelamedu",
    lat: 11.031,
    lng: 77.002,
  });

  const anita = await User.create({
    name: "Anita Devi",
    email: "anita@fixbuddy.com",
    phone: "+91 98765 33333",
    passwordHash,
    role: "customer",
    avatar: AV.anita,
    city: "Pollachi",
    area: "Town",
    status: "suspended",
    lat: 10.658,
    lng: 77.008,
  });

  const karthik = await User.create({
    name: "Karthik S",
    email: "karthik@fixbuddy.com",
    phone: "+91 98765 44444",
    passwordHash,
    role: "customer",
    avatar: AV.karthik,
    city: "Coimbatore",
    area: "Saibaba Colony",
    lat: 11.027,
    lng: 76.944,
  });

  const worker = await User.create({
    name: "Rakesh Kumar",
    email: "worker@fixbuddy.com",
    phone: "+91 98765 22000",
    passwordHash,
    role: "worker",
    avatar: AV.tech,
    city: "Coimbatore",
    area: "Peelamedu",
    lat: 11.03,
    lng: 77.0,
    provider: {
      businessName: "Rakesh Kumar",
      category: "AC Repair & Service",
      services: ["AC Repair", "AC Service", "Gas Refill"],
      serviceAreas: ["Peelamedu", "RS Puram", "Coimbatore"],
      hours: { from: "08:00", to: "20:00" },
      description: "Independent AC technician. Same-day visits across Coimbatore.",
      experience: "6 years",
      verified: true,
      available: true,
      startingPrice: 349,
      responseTime: "~20 mins",
      ratingAvg: 4.8,
      ratingCount: 18,
      completedJobs: 126,
      location: "Peelamedu, Coimbatore",
      aadhaarCard: AV.doc,
      panCard: AV.doc,
      onboarded: true,
    },
  });

  const coolair = await User.create({
    name: "CoolAir Solutions",
    email: "provider@fixbuddy.com",
    phone: "+91 98765 43210",
    passwordHash,
    role: "business",
    avatar: AV.cool,
    city: "Coimbatore",
    area: "RS Puram",
    lat: 11.0168,
    lng: 76.9558,
    provider: {
      businessName: "CoolAir Solutions",
      category: "Home Services",
      services: ["AC Installation", "AC Repair", "Cleaning"],
      serviceAreas: ["RS Puram", "Peelamedu", "Coimbatore"],
      hours: { from: "08:00", to: "20:00" },
      description: "Business work giver posting jobs for verified technicians.",
      experience: "12 years",
      verified: true,
      available: true,
      startingPrice: 399,
      responseTime: "~15 mins",
      ratingAvg: 4.9,
      ratingCount: 3,
      completedJobs: 847,
      location: "RS Puram, Coimbatore",
      gstCertificate: AV.doc,
      aadhaarCard: AV.doc,
      panCard: AV.doc,
      onboarded: true,
    },
  });

  const frost = await User.create({
    name: "FrostFix HVAC",
    email: "frost@fixbuddy.com",
    phone: "+91 87654 32109",
    passwordHash,
    role: "business",
    avatar: AV.frost,
    city: "Coimbatore",
    area: "Peelamedu",
    provider: {
      businessName: "FrostFix HVAC",
      category: "Home Services",
      services: ["AC Repair", "Refrigerant Refill"],
      serviceAreas: ["Peelamedu", "Coimbatore"],
      description: "Hiring field technicians for HVAC jobs.",
      experience: "8 years",
      verified: false,
      available: true,
      startingPrice: 349,
      location: "Peelamedu, Coimbatore",
      gstCertificate: AV.doc,
      onboarded: true,
    },
  });

  await User.create({
    name: "Arctic Air Experts",
    email: "arctic@fixbuddy.com",
    phone: "+91 76543 21098",
    passwordHash,
    role: "business",
    avatar: AV.arctic,
    city: "Pollachi",
    area: "Town",
    provider: {
      businessName: "Arctic Air Experts",
      category: "IT",
      services: ["PC Repair", "Laptop Repair"],
      serviceAreas: ["Pollachi", "Coimbatore"],
      description: "IT support jobs for offices.",
      experience: "10 years",
      verified: true,
      available: false,
      startingPrice: 449,
      ratingAvg: 4.8,
      ratingCount: 20,
      completedJobs: 612,
      location: "Pollachi",
      onboarded: true,
    },
  });

  await User.create({
    name: "TechFix Pro",
    email: "techfix@fixbuddy.com",
    phone: "+91 99887 76655",
    passwordHash,
    role: "worker",
    avatar: AV.tech,
    city: "Coimbatore",
    area: "Saibaba Colony",
    provider: {
      businessName: "TechFix Pro",
      category: "Laptop/Mobile Repair",
      services: ["Laptop Repair", "Screen Replacement", "Data Recovery"],
      serviceAreas: ["Saibaba Colony", "RS Puram", "Coimbatore"],
      description: "Certified laptop and mobile repair technician.",
      experience: "7 years",
      verified: true,
      available: true,
      startingPrice: 499,
      ratingAvg: 4.6,
      ratingCount: 40,
      completedJobs: 210,
      location: "Saibaba Colony, Coimbatore",
      onboarded: true,
    },
  });

  const PREFIX = { customer: "FB-CU", worker: "FB-WK", business: "FB-BZ", admin: "FB-AD" };
  const people = await User.find().sort({ createdAt: 1 });
  const counters = {};
  for (const account of people) {
    const role = account.role === "provider" ? "business" : account.role;
    counters[role] = (counters[role] || 0) + 1;
    account.userCode = `${PREFIX[role] || "FB-US"}-${String(counters[role]).padStart(4, "0")}`;
    if (account.email === "anita@fixbuddy.com") {
      const expired = buildLicense({ days: 1, plan: "trial" });
      expired.status = "expired";
      expired.expiresAt = new Date(Date.now() - 86400000);
      account.license = expired;
    } else {
      account.license = buildLicense({ days: 365, plan: account.role === "admin" ? "admin" : "pro" });
    }
    account.walletBalance = account.role === "customer" ? 2450 : account.role === "worker" ? 8600 : account.role === "business" ? 18500 : 0;
    await account.save();
  }

  const accepted = await Request.create({
    code: "REQ-0001",
    customerId: customer._id,
    providerId: worker._id,
    postedByRole: "customer",
    description: "AC not cooling properly. Needs servicing and possibly gas refill.",
    category: "AC Repair & Service",
    address: "12A Avinashi Road Apartments, RS Puram",
    area: "RS Puram",
    city: "Coimbatore",
    lat: 11.0168,
    lng: 76.9558,
    photos: [AV.doc],
    timing: "today",
    scheduledLabel: "Today, 6:00 PM",
    estimatedAmount: 499,
    tags: ["Urgent", "Split AC", "Gas Refill"],
    status: "accepted",
    matches: [{ providerId: worker._id, score: 92, reason: "category match, service area" }],
    timeline: [
      { status: "matching", note: "Request created", at: new Date(Date.now() - 3600000) },
      { status: "open", note: "Workers matched", at: new Date(Date.now() - 3500000) },
      { status: "accepted", note: "Worker accepted", at: new Date(Date.now() - 3000000) },
    ],
  });

  const openReq = await Request.create({
    code: "REQ-0002",
    customerId: priya._id,
    postedByRole: "customer",
    description: "Window AC not working. Making loud noise when turned on.",
    category: "AC Repair & Service",
    address: "Peelamedu, Sector 2",
    area: "Peelamedu",
    city: "Coimbatore",
    lat: 11.031,
    lng: 77.002,
    timing: "tomorrow",
    scheduledLabel: "Tomorrow morning",
    estimatedAmount: 399,
    tags: ["Window AC", "Noise Issue"],
    publicPost: true,
    status: "open",
    matches: [{ providerId: worker._id, score: 88, reason: "category match, service area" }],
    timeline: [{ status: "open", note: "Posted publicly", at: new Date() }],
  });

  const bizJob = await Request.create({
    code: "JOB-0001",
    customerId: coolair._id,
    postedByRole: "business",
    description: "Need 2 AC technicians for a 3-floor office service tomorrow.",
    category: "AC Repair & Service",
    address: "Brookefields office park",
    area: "RS Puram",
    city: "Coimbatore",
    lat: 11.016,
    lng: 76.96,
    timing: "tomorrow",
    scheduledLabel: "Tomorrow, 9:00 AM",
    estimatedAmount: 2500,
    tags: ["Office", "Team job"],
    publicPost: true,
    status: "open",
    matches: [{ providerId: worker._id, score: 80, reason: "category match" }],
    timeline: [{ status: "open", note: "Business posted a job", at: new Date() }],
  });

  const completed = await Request.create({
    code: "REQ-0003",
    customerId: customer._id,
    providerId: worker._id,
    postedByRole: "customer",
    description: "Annual AC service completed.",
    category: "AC Repair & Service",
    address: "RS Puram",
    area: "RS Puram",
    city: "Coimbatore",
    timing: "custom",
    scheduledLabel: "Yesterday, 11:00 AM",
    estimatedAmount: 850,
    status: "completed",
    timeline: [
      { status: "requested", note: "Requested", at: new Date(Date.now() - 86400000 * 2) },
      { status: "completed", note: "Done", at: new Date(Date.now() - 86400000) },
    ],
  });

  const scheduled = await Request.create({
    code: "JOB-0002",
    customerId: karthik._id,
    providerId: worker._id,
    postedByRole: "customer",
    description: "PC Repair at home — boot loop after power cut.",
    category: "PC Repair",
    address: "Saibaba Colony",
    area: "Saibaba Colony",
    city: "Coimbatore",
    timing: "today",
    scheduledLabel: "Today, 4:00 PM",
    estimatedAmount: 699,
    status: "scheduled",
    timeline: [{ status: "scheduled", note: "Scheduled", at: new Date() }],
  });

  const conv = await Conversation.create({
    requestId: accepted._id,
    customerId: customer._id,
    providerId: worker._id,
    lastMessage: "I will be there by 6 PM. Please keep the remote ready.",
    lastAt: new Date(),
    unreadCustomer: 1,
    unreadProvider: 0,
  });

  await Message.insertMany([
    { conversationId: conv._id, senderId: worker._id, text: "Hello! I have received your request for AC repair." },
    { conversationId: conv._id, senderId: customer._id, text: "Hi! Yes, the AC is not cooling at all. Might need gas refill." },
    { conversationId: conv._id, senderId: worker._id, text: "Understood. I will check the gas level and other components when I arrive." },
    { conversationId: conv._id, senderId: worker._id, text: "I will be there by 6 PM. Please keep the remote ready." },
  ]);

  await Review.create({
    requestId: completed._id,
    customerId: customer._id,
    providerId: worker._id,
    rating: 5,
    comment: "Excellent service! The technician arrived on time and fixed the AC within an hour.",
  });

  await Complaint.insertMany([
    { code: "CMP-001", reporterId: customer._id, againstId: worker._id, requestId: accepted._id, party: "customer", subject: "Bad service", body: "Arrived late", status: "open" },
    { code: "CMP-002", reporterId: coolair._id, againstId: worker._id, party: "provider", subject: "Payment issue", body: "Invoice mismatch", status: "investigating" },
    { code: "CMP-003", reporterId: priya._id, party: "customer", subject: "No show", body: "Worker did not arrive", status: "resolved" },
  ]);

  await Transaction.insertMany([
    { code: "TXN-1001", requestId: completed._id, fromId: customer._id, toId: worker._id, amount: 850, kind: "payment", status: "paid", note: "AC service" },
    { code: "TXN-1002", requestId: completed._id, fromId: worker._id, toId: admin._id, amount: 85, kind: "commission", status: "paid", note: "10% platform fee" },
    { code: "TXN-1003", requestId: completed._id, fromId: admin._id, toId: worker._id, amount: 765, kind: "payout", status: "paid", note: "Worker payout" },
    { code: "TXN-1004", amount: 399, kind: "refund", status: "refunded", note: "Cancelled booking refund", fromId: admin._id, toId: priya._id },
  ]);

  await AuditLog.insertMany([
    { adminId: admin._id, adminName: "Fixbuddy Admin", action: "Verified account", target: "worker@fixbuddy.com", ip: "127.0.0.1" },
    { adminId: admin._id, adminName: "Fixbuddy Admin", action: "Set status suspended", target: "anita@fixbuddy.com", ip: "127.0.0.1" },
    { adminName: "System", action: "Platform seeded", target: "FixBuddy", ip: "127.0.0.1" },
  ]);

  await PlatformSettings.create({ key: "default" });

  await Notification.insertMany([
    { userId: customer._id, type: "success", text: "Rakesh Kumar accepted your request", requestId: accepted._id },
    { userId: customer._id, type: "info", text: "Your AC service is scheduled for Today, 6:00 PM", requestId: accepted._id },
    { userId: worker._id, type: "request", text: "New work request: AC repair in Peelamedu", requestId: openReq._id },
    { userId: worker._id, type: "request", text: "New business job: office AC service in RS Puram", requestId: bizJob._id },
    { userId: coolair._id, type: "info", text: "Your job JOB-0001 is live for workers" },
    { userId: admin._id, type: "info", text: "Platform seeded and ready" },
    { userId: worker._id, type: "info", text: `Scheduled PC repair ${scheduled.code}` },
  ]);

  console.log("Seed complete. Demo logins (password: password123)");
  console.log("  customer@fixbuddy.com  → Customer (creates requests)");
  console.log("  provider@fixbuddy.com  → Business (creates jobs)");
  console.log("  worker@fixbuddy.com    → Worker (job seeker)");
  console.log("  admin@fixbuddy.com     → Super Admin");
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
