"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Result = { parameter: string; value: number; unit: string; refLow: number; refHigh: number; flag: string };
type Data = {
  order: { orderCode: string; status: string; doctor?: string | null };
  results: Result[];
  summary: { kind: "critical" } | { kind: "ok"; text: string } | null;
};

const LANGS = [["en", "English"], ["te", "తెలుగు"], ["hi", "हिन्दी"]] as const;
const FLAG_COLOR: Record<string, string> = { NORMAL: "var(--brand)", LOW: "var(--warn)", HIGH: "var(--warn)", CRITICAL: "var(--bad)" };
const CRIT_MSG: Record<string, string> = {
  en: "One of your results needs urgent attention. Our team will call you shortly.",
  te: "మీ ఫలితాల్లో ఒకటి తక్షణ శ్రద్ధ అవసరం. మా బృందం మీకు త్వరలో ఫోన్ చేస్తుంది.",
  hi: "आपके एक परिणाम पर तुरंत ध्यान देना ज़रूरी है। हमारी टीम जल्द आपको फ़ोन करेगी।",
};

export default function Report() {
  const { id } = useParams<{ id: string }>();
  const [lang, setLang] = useState("en");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/orders/${id}?lang=${lang}`)
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/login"; return; }
        if (!r.ok) { setErr("Report not found."); return; }
        setData(await r.json());
      })
      .catch(() => setErr("Could not load the report."));
  }, [id, lang]);

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <a href="/orders" className="text-[var(--muted)] underline">← Back</a>
      <div className="flex gap-2">
        {LANGS.map(([k, n]) => (
          <button key={k} onClick={() => setLang(k)}
            className={`flex-1 rounded-xl border p-3 ${lang === k ? "bg-[var(--brand)] text-white" : "bg-white"}`}>{n}</button>
        ))}
      </div>
      {err && <p role="alert" className="text-[var(--bad)]">{err}</p>}
      {!data && !err && <p className="text-[var(--muted)]">Loading…</p>}
      {data && (<>
        <h1 className="text-2xl font-semibold">{data.order.orderCode}</h1>
        {data.results.map((r) => (
          <div key={r.parameter} className="card space-y-1">
            <div className="font-semibold">{r.parameter}</div>
            <div className="text-3xl font-bold" style={{ color: FLAG_COLOR[r.flag] }}>{r.value} <span className="text-base">{r.unit}</span></div>
            <div className="text-[var(--muted)]">Normal: {r.refLow} – {r.refHigh}</div>
          </div>
        ))}
        {data.summary?.kind === "critical" && <div className="card border-[var(--bad)]">{CRIT_MSG[lang]}</div>}
        {data.summary?.kind === "ok" && <div className="card">{data.summary.text}</div>}
        {data.order.status === "PROCESSING" && <p className="text-[var(--warn)]">Your report is still being prepared.</p>}
      </>)}
    </main>
  );
}


