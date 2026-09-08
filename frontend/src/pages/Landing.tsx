import React, { useState } from "react";
import { Search, ArrowRight, CheckCircle, Zap, Shield, Star, ChevronRight, Menu, X } from "lucide-react";
import { View } from "../types";
import { Button, Badge } from "../components/ui";
import { useApp, useFetch } from "../api/AppContext";
import type { ServiceCategory } from "../api/client";
import CategoryIcon from "../components/CategoryIcon";
import SupportContact from "../components/SupportContact";

const D = ({ children }: { children: React.ReactNode }) => (
  <span style={{ fontFamily: "Outfit, sans-serif" }}>{children}</span>
);

export default function Landing({ navigate }: { navigate: (v: View) => void }) {
  const { setRequestData, user } = useApp();
  const { data: catData } = useFetch<{ categories: ServiceCategory[] }>("/categories");
  const { data: live } = useFetch<{ customers: number; businesses: number; workers: number; categories: number; ratingAvg: number }>("/public/stats");
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchVal, setSearchVal] = useState("");
  const serviceCategories = catData?.categories || [];

  const goCustomer = () => {
    navigate(user?.role === "customer" ? "customer-home" : user ? "login" : "login");
  };

  const handleSearch = () => {
    if (searchVal.trim()) setRequestData({ description: searchVal.trim() });
    goCustomer();
  };

  const scrollTo = (id: string) => {
    setMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const navigation = [
    { label: "Home", action: () => scrollTo("home") },
    { label: "How it Works", action: () => scrollTo("how-it-works") },
    { label: "Services", action: () => scrollTo("services") },
    { label: "For Businesses", action: () => navigate("business-landing") },
    { label: "About", action: () => scrollTo("about") },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => scrollTo("home")} className="flex items-center gap-2">
            <span className="w-8 h-8 bg-brand rounded-xl flex items-center justify-center text-white font-bold text-base">F</span>
            <span className="font-display font-bold text-xl text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Fixbuddy</span>
          </button>
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navigation.map((item) => (
              <button key={item.label} onClick={item.action} className="text-sm text-slate-600 hover:text-brand font-medium transition-colors">
                {item.label}
              </button>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("login")}>Login</Button>
            <Button variant="primary" size="sm" onClick={() => navigate("signup")}>Sign Up</Button>
          </div>
          <button className="md:hidden p-2 rounded-xl hover:bg-slate-100" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 px-4 py-4 space-y-2 animate-slide-up">
            {navigation.map((item) => (
              <button key={item.label} onClick={item.action} className="block w-full text-left py-2 text-sm text-slate-600 font-medium">{item.label}</button>
            ))}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" size="sm" fullWidth onClick={() => navigate("login")}>Login</Button>
              <Button variant="primary" size="sm" fullWidth onClick={() => navigate("signup")}>Sign Up</Button>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ── */}
      <section id="home" className="relative bg-gradient-to-br from-sky-50 via-white to-blue-50 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-sky-200/30 via-transparent to-transparent pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="info" className="mb-6 text-sm px-4 py-1.5">
              <Zap className="w-3.5 h-3.5" /> Smart problem-solving platform
            </Badge>
            <h1
              className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 leading-tight mb-6"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Got something to fix?{" "}
              <span className="text-brand">Find the right help.</span>
            </h1>
            <p className="text-lg text-slate-600 mb-10 max-w-xl mx-auto">
              Tell Fixbuddy what you need. Discover the right people and businesses to get it done.
            </p>

            {/* Search Box */}
            <div className="bg-white rounded-2xl shadow-lg border border-sky-100 p-3 flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto mb-6">
              <div className="flex-1 flex items-center gap-3 px-3">
                <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="What do you need help with?"
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none text-base"
                />
              </div>
              <Button variant="primary" size="lg" onClick={handleSearch} className="whitespace-nowrap">
                Find Help <ArrowRight className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick examples */}
            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <span className="text-sm text-slate-500">Try:</span>
              {["AC repair", "Plumber", "Laptop repair", "Cleaning", "Electrician"].map((ex) => (
                <button
                  key={ex}
                  onClick={() => { setSearchVal(ex); setRequestData({ description: ex }); goCustomer(); }}
                  className="text-sm text-brand bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-full font-medium transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Secondary CTA */}
            <button
              onClick={() => navigate(user?.role === "customer" ? "create-request" : "login")}
              className="text-sm font-medium text-slate-600 hover:text-brand underline underline-offset-4 transition-colors"
            >
              Or post a detailed request →
            </button>
          </div>
        </div>
      </section>

      {/* ── Service Categories ── */}
      <section id="services" className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Popular Services</h2>
            <p className="text-slate-500">Everything you need, all in one place</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 md:gap-4">
            {serviceCategories.map((cat) => (
              <button
                key={cat._id || cat.name}
                onClick={() => { setRequestData({ category: cat.name, description: cat.name }); goCustomer(); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border border-sky-100 hover:border-sky-300 hover:shadow-md transition-all duration-200 group"
              >
                <span className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CategoryIcon icon={cat.icon} className="w-6 h-6" />
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-700 text-center">{cat.name}</span>
              </button>
            ))}
            {!serviceCategories.length && (
              <p className="col-span-full text-sm text-slate-500 text-center">Live categories will appear here once the service catalog is available.</p>
            )}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-16 bg-sky-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>How Fixbuddy Works</h2>
            <p className="text-slate-500 max-w-md mx-auto">Three simple steps between you and the solution</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                icon: "✍️",
                title: "Tell us what you need",
                desc: "Describe your problem in your own words. No complicated categories to navigate.",
                color: "sky",
              },
              {
                step: "02",
                icon: "🔍",
                title: "Find the right solution",
                desc: "Fixbuddy identifies relevant businesses and service providers near you.",
                color: "blue",
              },
              {
                step: "03",
                icon: "✅",
                title: "Get it done",
                desc: "Connect, schedule, and complete the work. Review when done.",
                color: "indigo",
              },
            ].map((item) => (
              <div key={item.step} className="relative bg-white rounded-3xl p-8 shadow-sm border border-sky-100 text-center">
                <span className="absolute top-4 right-4 text-xs font-bold text-sky-300 font-display" style={{ fontFamily: "Outfit, sans-serif" }}>{item.step}</span>
                <div className="text-4xl mb-4">{item.icon}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>{item.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button variant="primary" size="lg" onClick={() => navigate(user?.role === "customer" ? "create-request" : "login")}>
              Start a Request <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* ── Trust Signals ── */}
      <section id="about" className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Shield className="w-6 h-6" />, title: "Verified Businesses", desc: "All service providers go through a verification process before joining.", color: "emerald" },
              { icon: <Star className="w-6 h-6" />, title: "Rated & Reviewed", desc: "Real reviews from real customers help you make informed decisions.", color: "amber" },
              { icon: <Zap className="w-6 h-6" />, title: "Fast Matching", desc: "Quickly matched with available providers based on your location.", color: "sky" },
            ].map((item) => (
              <div key={item.title} className="flex gap-4 p-6 rounded-2xl border border-slate-100 hover:border-sky-200 hover:shadow-sm transition-all">
                <span className={`p-3 rounded-xl bg-${item.color}-50 text-${item.color}-600 h-fit`}>
                  {item.icon}
                </span>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{item.title}</h3>
                  <p className="text-sm text-slate-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Business CTA ── */}
      <section className="py-16 bg-brand">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-white text-center md:text-left">
              <h2 className="text-3xl font-bold mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Are you a service provider?</h2>
              <p className="text-sky-100 max-w-md">Get more relevant work with Fixbuddy. Connect with customers actively looking for the services you provide.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => {
                  try { sessionStorage.setItem("fb_signup_role", "business"); } catch { /* ignore */ }
                  navigate("signup");
                }}
                className="inline-flex items-center justify-center min-h-12 px-6 rounded-xl bg-white text-sky-800 text-base font-semibold shadow-md hover:bg-sky-50"
              >
                Create free
              </button>
              <SupportContact
                variant="button"
                className="inline-flex items-center justify-center gap-2 min-h-12 px-6 rounded-xl border-2 border-white text-white text-base font-semibold hover:bg-white/10"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="py-12 bg-white border-t border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: String(live?.customers ?? 0), label: "Customers" },
              { value: String(live?.businesses ?? 0), label: "Businesses" },
              { value: live?.ratingAvg ? `${live.ratingAvg}★` : "—", label: "Average Rating" },
              { value: String(live?.categories ?? 0), label: "Service Types" },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-black text-brand mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col md:flex-row justify-between gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="w-7 h-7 bg-sky-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">F</span>
                <span className="text-white font-bold text-lg" style={{ fontFamily: "Outfit, sans-serif" }}>Fixbuddy</span>
              </div>
              <p className="text-sm max-w-xs">Your smart everyday problem-solving platform. Get things done.</p>
              <SupportContact
                variant="stack"
                className="block text-sm text-sky-400 mt-3 hover:text-sky-300"
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-sm">
              {[
                { title: "Product", links: ["How it Works", "Services", "Pricing", "Blog"] },
                { title: "Business", links: ["Join as Business", "For Teams", "Enterprise", "Resources"] },
                { title: "Company", links: ["About Us", "Careers", "Press", "Contact support"] },
              ].map((col) => (
                <div key={col.title}>
                  <p className="text-white font-semibold mb-3">{col.title}</p>
                  {col.links.map((link) =>
                    link === "Contact support" ? (
                      <SupportContact key={link} className="block py-1 text-sky-400 hover:text-sky-300 text-left" />
                    ) : (
                      <button key={link} onClick={() => link === "Join as Business" ? navigate("business-landing") : scrollTo(link === "How it Works" ? "how-it-works" : link === "Services" ? "services" : "about")} className="block py-1 hover:text-sky-400 transition-colors text-left">{link}</button>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 text-xs flex flex-col sm:flex-row justify-between gap-2">
            <p>© 2024 Fixbuddy. All rights reserved.</p>
            <div className="flex gap-4">
              <button onClick={() => scrollTo("about")} className="hover:text-sky-400">Privacy Policy</button>
              <button onClick={() => scrollTo("about")} className="hover:text-sky-400">Terms of Service</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
