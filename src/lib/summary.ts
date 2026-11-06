import type { Flag } from "./rules";

export type Lang = "en" | "te" | "hi";

type Item = { parameter: string; value: number; unit: string; flag: Flag };

const FLAG_TEXT: Record<Lang, Record<"LOW" | "HIGH", string>> = {
  en: { LOW: "is lower than the normal range", HIGH: "is higher than the normal range" },
  te: { LOW: "సాధారణ పరిధి కంటే తక్కువగా ఉంది", HIGH: "సాధారణ పరిధి కంటే ఎక్కువగా ఉంది" },
  hi: { LOW: "सामान्य सीमा से कम है", HIGH: "सामान्य सीमा से अधिक है" },
};

const ALL_NORMAL: Record<Lang, string> = {
  en: "All values in this report are within the normal range.",
  te: "ఈ రిపోర్టులోని అన్ని విలువలు సాధారణ పరిధిలో ఉన్నాయి.",
  hi: "इस रिपोर्ट के सभी मान सामान्य सीमा में हैं।",
};

const FOOTER: Record<Lang, string> = {
  en: "This is a simple explanation. Please see your doctor for advice.",
  te: "ఇది సులభమైన వివరణ మాత్రమే. సలహా కోసం మీ డాక్టర్‌ను కలవండి.",
  hi: "यह एक सरल व्याख्या है। सलाह के लिए अपने डॉक्टर से मिलें।",
};

export type SummaryResult =
  | { kind: "critical" }
  | { kind: "ok"; text: string };

export function buildSummary(items: Item[], lang: Lang): SummaryResult {
  // Critical values get NO summary; staff call back instead
  if (items.some((i) => i.flag === "CRITICAL")) return { kind: "critical" };

  const abnormal = items.filter((i) => i.flag === "LOW" || i.flag === "HIGH");
  if (abnormal.length === 0) return { kind: "ok", text: `${ALL_NORMAL[lang]} ${FOOTER[lang]}` };

  const lines = abnormal.map(
    (i) => `${i.parameter} (${i.value} ${i.unit}) ${FLAG_TEXT[lang][i.flag as "LOW" | "HIGH"]}.`
  );
  return { kind: "ok", text: `${lines.join(" ")} ${FOOTER[lang]}` };
}