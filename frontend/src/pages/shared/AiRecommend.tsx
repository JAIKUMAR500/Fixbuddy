import React from "react";
import { Sparkles } from "lucide-react";
import { Card, Badge } from "../../components/ui";
import { useLang } from "../../i18n/LangContext";

export default function AiRecommend() {
  const { t } = useLang();
  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Card className="overflow-hidden text-center py-10 px-6">
        <img src="/brand/ai-robot.png" alt="" className="w-40 h-40 mx-auto object-contain drop-shadow-md" />
        <Badge variant="info" className="mt-5">{t("ai.soon")}</Badge>
        <h1 className="text-2xl font-black font-display mt-3 flex items-center justify-center gap-2">
          <Sparkles className="w-6 h-6 text-brand" /> {t("ai.title")}
        </h1>
        <p className="text-sm text-slate-500 mt-3 max-w-md mx-auto leading-relaxed">{t("ai.body")}</p>
      </Card>
    </div>
  );
}
