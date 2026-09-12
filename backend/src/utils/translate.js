const PHRASES = [
  { en: "water leak", ta: "தண்ணீர் கசிவு", hi: "पानी लीक" },
  { en: "kitchen sink", ta: "சமையலறை சிங்க்", hi: "किचन सिंक" },
  { en: "not cooling", ta: "குளிர்ச்சி இல்லை", hi: "ठंडक नहीं आ रही" },
  { en: "ac not working", ta: "ஏசி வேலை செய்யவில்லை", hi: "एसी काम नहीं कर रहा" },
  { en: "tap leaking", ta: "குழாய் கசிகிறது", hi: "नल लीक हो रहा है" },
  { en: "no power", ta: "மின்சாரம் இல்லை", hi: "बिजली नहीं है" },
  { en: "urgent", ta: "அவசரம்", hi: "जरूरी" },
  { en: "geyser", ta: "கியேசர்", hi: "गीजर" },
  { en: "cleaning", ta: "சுத்தம்", hi: "सफाई" },
];

export function normalizeLang(value) {
  const v = String(value || "en").toLowerCase();
  if (v.startsWith("ta")) return "ta";
  if (v.startsWith("hi")) return "hi";
  return "en";
}

export function translateText(text, fromLang, toLang) {
  const src = String(text || "").trim();
  const from = normalizeLang(fromLang);
  const to = normalizeLang(toLang);
  if (!src || from === to) return src;
  let out = src;
  for (const row of PHRASES) {
    const a = row[from];
    const b = row[to];
    if (a && b && out.toLowerCase().includes(a.toLowerCase())) {
      out = out.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"), b);
    }
  }
  if (out === src) {
    const tag = to === "hi" ? "[HI] " : to === "ta" ? "[TA] " : "";
    return `${tag}${src}`;
  }
  return out;
}
