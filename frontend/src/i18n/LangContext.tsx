import React, { createContext, useContext, useMemo, useState } from "react";

export type Lang = "en" | "ta";

const STRINGS: Record<Lang, Record<string, string>> = {
  en: {
    "nav.home": "Home",
    "nav.find": "Find a Service",
    "nav.requests": "My Requests",
    "nav.bookings": "Bookings",
    "nav.messages": "Messages",
    "nav.reviews": "Reviews",
    "nav.saved": "Saved",
    "nav.wallet": "Wallet",
    "nav.license": "License",
    "nav.support": "Support",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.dashboard": "Dashboard",
    "nav.postJob": "Post a Job",
    "nav.myJobs": "My Jobs",
    "nav.available": "Available Jobs",
    "nav.services": "My Services",
    "nav.earnings": "Earnings",
    "nav.schedule": "Schedule",
    "nav.analytics": "Analytics",
    "nav.team": "Team",
    "nav.ai": "AI Jobs",
    "nav.signOut": "Sign out",
    "lang.en": "English",
    "lang.ta": "தமிழ்",
    "common.save": "Save",
    "common.skip": "Skip for now",
    "common.add": "Add",
    "common.edit": "Edit",
    "common.delete": "Remove",
    "common.call": "Call",
    "common.cancel": "Cancel",
    "prompt.title": "Tell us a little more",
    "prompt.sub": "Optional — skip anytime. This helps match the right work.",
    "prompt.age": "Age",
    "prompt.phone": "Mobile number",
    "prompt.job": "Type of job / work",
    "prompt.studies": "Studies / education",
    "prompt.address": "Address",
    "prompt.aadhaar": "Aadhaar (optional)",
    "prompt.pan": "PAN (optional)",
    "prompt.gps": "Use live location",
    "services.title": "My Services",
    "services.sub": "Add, edit or remove the work you offer.",
    "services.name": "Service name",
    "services.price": "Starting price ₹",
    "ai.title": "AI job recommendation",
    "ai.soon": "Coming soon",
    "ai.body": "FixBuddy AI will soon suggest the best nearby jobs for you based on your skills, location and past work.",
    "team.title": "Team",
    "team.groups": "Groups",
    "team.members": "Members",
    "team.invite": "Add member",
    "team.newGroup": "New group",
  },
  ta: {
    "nav.home": "முகப்பு",
    "nav.find": "சேவை தேடு",
    "nav.requests": "என் கோரிக்கைகள்",
    "nav.bookings": "முன்பதிவு",
    "nav.messages": "செய்திகள்",
    "nav.reviews": "மதிப்புரை",
    "nav.saved": "சேமித்தவை",
    "nav.wallet": "வாலட்",
    "nav.license": "உரிமம்",
    "nav.support": "உதவி",
    "nav.profile": "சுயவிவரம்",
    "nav.settings": "அமைப்புகள்",
    "nav.dashboard": "டாஷ்போர்டு",
    "nav.postJob": "வேலை இடு",
    "nav.myJobs": "என் வேலைகள்",
    "nav.available": "கிடைக்கும் வேலைகள்",
    "nav.services": "என் சேவைகள்",
    "nav.earnings": "வருமானம்",
    "nav.schedule": "அட்டவணை",
    "nav.analytics": "பகுப்பாய்வு",
    "nav.team": "குழு",
    "nav.ai": "AI வேலைகள்",
    "nav.signOut": "வெளியேறு",
    "lang.en": "English",
    "lang.ta": "தமிழ்",
    "common.save": "சேமி",
    "common.skip": "இப்போது தவிர்",
    "common.add": "சேர்",
    "common.edit": "திருத்து",
    "common.delete": "நீக்கு",
    "common.call": "அழை",
    "common.cancel": "ரத்து",
    "prompt.title": "சிறிது தகவல் தரவும்",
    "prompt.sub": "கட்டாயம் இல்லை — பின்னர் நிரப்பலாம். சரியான வேலை பொருத்த உதவும்.",
    "prompt.age": "வயது",
    "prompt.phone": "கைபேசி எண்",
    "prompt.job": "வேலை வகை",
    "prompt.studies": "படிப்பு",
    "prompt.address": "முகவரி",
    "prompt.aadhaar": "ஆதார் (விருப்பம்)",
    "prompt.pan": "PAN (விருப்பம்)",
    "prompt.gps": "நேரடி இருப்பிடம்",
    "services.title": "என் சேவைகள்",
    "services.sub": "நீங்கள் செய்யும் வேலைகளை சேர்க்கவும், திருத்தவும்.",
    "services.name": "சேவை பெயர்",
    "services.price": "தொடக்க விலை ₹",
    "ai.title": "AI வேலை பரிந்துரை",
    "ai.soon": "விரைவில்",
    "ai.body": "உங்கள் திறன், இடம் மற்றும் பழைய வேலை அடிப்படையில் அருகில் உள்ள சிறந்த வேலைகளை FixBuddy AI பரிந்துரைக்கும்.",
    "team.title": "குழு",
    "team.groups": "பிரிவுகள்",
    "team.members": "உறுப்பினர்கள்",
    "team.invite": "உறுப்பினர் சேர்",
    "team.newGroup": "புதிய பிரிவு",
  },
};

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem("fb_lang");
      if (saved === "ta" || saved === "en") return saved;
    } catch {
      /* ignore */
    }
    return "en";
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("fb_lang", l);
    } catch {
      /* ignore */
    }
  };

  const value = useMemo<Ctx>(
    () => ({
      lang,
      setLang,
      t: (key) => STRINGS[lang][key] || STRINGS.en[key] || key,
    }),
    [lang]
  );

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
