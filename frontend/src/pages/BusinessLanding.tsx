import React from "react";
import { ArrowRight, TrendingUp, Users, Briefcase, MessageSquare, BarChart2, Shield } from "lucide-react";
import { View } from "../types";
import { Button, Badge } from "../components/ui";

import SupportContact from "../components/SupportContact";

export default function BusinessLanding({ navigate }: { navigate: (v: View) => void }) {
  const goSignup = () => {
    try {
      sessionStorage.setItem("fb_signup_role", "business");
    } catch {
      /* ignore */
    }
    navigate("signup");
  };
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("landing")} className="flex items-center gap-2">
            <span className="w-8 h-8 bg-sky-600 rounded-xl flex items-center justify-center text-white font-bold text-base">F</span>
            <span className="font-display font-bold text-xl text-slate-900" style={{ fontFamily: "Outfit, sans-serif" }}>Fixbuddy</span>
          </button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("login")}>Sign In</Button>
            <Button variant="primary" size="sm" onClick={goSignup}>Join as Business</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900 text-white py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
          <Badge variant="info" className="mb-6 bg-sky-700/60 text-sky-200 border-sky-600">
            🚀 For Service Providers & Businesses
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
            Get more relevant work{" "}
            <span className="text-sky-400">with Fixbuddy.</span>
          </h1>
          <p className="text-sky-100 text-lg max-w-xl mx-auto mb-10">
            Connect with customers who are actively looking for the services you provide. Manage jobs, grow your business.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              type="button"
              onClick={goSignup}
              className="inline-flex items-center justify-center gap-2 min-h-14 px-7 rounded-2xl bg-white text-sky-800 text-base font-semibold shadow-lg hover:bg-sky-50 transition-transform hover:-translate-y-0.5"
            >
              Create a free account <ArrowRight className="w-5 h-5" />
            </button>
            <SupportContact
              variant="button"
              className="inline-flex items-center justify-center gap-2 min-h-14 px-7 rounded-2xl border-2 border-white/70 text-white text-base font-semibold hover:bg-white/10 transition-colors"
            />
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Why businesses choose Fixbuddy</h2>
            <p className="text-slate-500">Everything you need to grow your service business</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: <Briefcase className="w-6 h-6" />, title: "More Work Opportunities", desc: "Receive relevant customer requests matching your services directly in your dashboard.", color: "sky" },
              { icon: <Users className="w-6 h-6" />, title: "Targeted Customer Reach", desc: "Reach customers actively looking for your specific services in your area.", color: "blue" },
              { icon: <TrendingUp className="w-6 h-6" />, title: "Business Visibility", desc: "Get discovered by thousands of customers searching for services like yours.", color: "indigo" },
              { icon: <MessageSquare className="w-6 h-6" />, title: "Direct Communication", desc: "Connect directly with customers via integrated messaging. No middlemen.", color: "sky" },
              { icon: <BarChart2 className="w-6 h-6" />, title: "Growth Insights", desc: "Track jobs, earnings, ratings and customer trends with an easy dashboard.", color: "blue" },
              { icon: <Shield className="w-6 h-6" />, title: "Verified Business Profile", desc: "Build trust with customers through a verified profile, reviews and ratings.", color: "indigo" },
            ].map((b) => (
              <div key={b.title} className="p-6 rounded-2xl border border-slate-100 hover:border-sky-200 hover:shadow-md transition-all duration-200 group">
                <div className={`w-12 h-12 rounded-2xl bg-${b.color}-50 text-${b.color}-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  {b.icon}
                </div>
                <h3 className="font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{b.title}</h3>
                <p className="text-sm text-slate-500">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works for businesses */}
      <section className="py-16 bg-sky-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3" style={{ fontFamily: "Outfit, sans-serif" }}>Get started in minutes</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Create Profile", desc: "Set up your business profile with services, location, and photos." },
              { step: "2", title: "Receive Requests", desc: "Get notified when customers need services you offer." },
              { step: "3", title: "Accept Jobs", desc: "Review and accept relevant work opportunities." },
              { step: "4", title: "Grow Business", desc: "Build reviews, increase visibility, and grow your customer base." },
            ].map((s) => (
              <div key={s.step} className="bg-white rounded-2xl p-6 border border-sky-100 text-center relative">
                <div className="w-10 h-10 bg-sky-600 text-white rounded-full flex items-center justify-center text-lg font-bold mx-auto mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>
                  {s.step}
                </div>
                <h3 className="font-bold text-slate-900 mb-2" style={{ fontFamily: "Outfit, sans-serif" }}>{s.title}</h3>
                <p className="text-sm text-slate-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing/Testimonials row */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="bg-sky-600 rounded-3xl p-8 sm:p-12 text-white text-center shadow-xl animate-float-in">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ fontFamily: "Outfit, sans-serif" }}>Ready to grow your business?</h2>
            <p className="text-sky-50 text-base sm:text-lg mb-8 max-w-lg mx-auto">Join thousands of businesses already using Fixbuddy to get more work.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                type="button"
                onClick={goSignup}
                className="inline-flex items-center justify-center min-h-14 px-8 rounded-2xl bg-white text-sky-800 text-base font-semibold shadow-md hover:bg-sky-50 transition-transform hover:-translate-y-0.5"
              >
                Create free
              </button>
              <SupportContact
                variant="button"
                className="inline-flex items-center justify-center gap-2 min-h-14 px-8 rounded-2xl border-2 border-white text-white text-base font-semibold hover:bg-white/15 transition-colors"
              />
            </div>
            <button type="button" onClick={() => navigate("login")} className="mt-5 text-sm text-sky-100 underline underline-offset-4 hover:text-white">
              Already a member? Sign in
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
