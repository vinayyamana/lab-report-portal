"use client";
import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Result = { parameter: string; value: number; unit: string; refLow: number; refHigh: number; flag: string };
type Data = {
  order: { orderCode: string; status: string; doctor?: string | null };
  results: Result[];
  summary: { kind: "critical" } | { kind: "ok"; text: string } | null;
};
type Lang = "en" | "te" | "hi";

const LANGS: [Lang, string][] = [["en", "English"], ["te", "తెలుగు"], ["hi", "हिन्दी"]];
const FLAG_COLOR: Record<string, string> = { NORMAL: "var(--brand)", LOW: "var(--warn)", HIGH: "var(--warn)", CRITICAL: "var(--bad)" };
const FLAG_LABEL: Record<string, string> = { NORMAL: "Normal", LOW: "Low", HIGH: "High", CRITICAL: "Critical" };
const FLAG_BADGE: Record<string, string> = { NORMAL: "badge-ok", LOW: "badge-low", HIGH: "badge-high", CRITICAL: "badge-critical" };
const CRIT_MSG: Record<Lang, string> = {
  en: "One of your results needs urgent attention. Our team will call you shortly.",
  te: "మీ ఫలితాల్లో ఒకటి తక్షణ శ్రద్ధ అవసరం. మా బృందం మీకు త్వరలో ఫోన్ చేస్తుంది.",
  hi: "आपके एक परिणाम पर तुरंत ध्यान देना ज़रूरी है। हमारी टीम जल्द आपको फ़ोन करेगी।",
};

function ReportInner() {
  const { id } = useParams<{ id: string }>();
  const [lang, setLang] = useState<Lang>("en");
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setErr("");
    fetch(`/api/orders/${id}?lang=${lang}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/login"; return; }
        if (!r.ok) { setErr("Report not found."); return; }
        setData(await r.json());
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setErr("Could not load the report. Check your connection.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
  }, [id, lang, tries]);

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4" aria-busy={loading}>
      <a href="/orders" className="muted underline inline-block py-2">← Back</a>

      <div className="flex gap-2" role="group" aria-label="Language">
        {LANGS.map(([k, n]) => (
          <button
            key={k}
            onClick={() => setLang(k)}
            aria-pressed={lang === k}
            lang={k}
            className={`flex-1 rounded-xl border p-3 font-semibold ${lang === k ? "bg-[var(--brand)] text-white" : "bg-white"}`}
          >
            {n}
          </button>
        ))}
      </div>

      {err && (
        <div role="alert" className="notice notice-error space-y-3">
          <p>{err}</p>
          <button className="btn-secondary w-full" onClick={() => setTries((t) => t + 1)}>Try again</button>
        </div>
      )}

      {loading && !data && !err && (
        <div className="space-y-4" aria-label="Loading report">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-32" />
          <div className="skeleton h-24" />
        </div>
      )}

      {data && !err && (
        <>
          <h1 className="text-2xl font-semibold">{data.order.orderCode}</h1>

          {data.results.length === 0 && (
            <div className="notice notice-info">No results available yet.</div>
          )}

          {data.results.map((r) => (
            <div key={r.parameter} className="card space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold">{r.parameter}</div>
                <span className={`badge ${FLAG_BADGE[r.flag] ?? "badge-ok"}`}>{FLAG_LABEL[r.flag] ?? r.flag}</span>
              </div>
              <div className="text-3xl font-bold" style={{ color: FLAG_COLOR[r.flag] }}>
                {r.value} <span className="text-base">{r.unit}</span>
              </div>
              <div className="muted">Normal: {r.refLow} – {r.refHigh}</div>
            </div>
          ))}

          {loading ? (
            <div className="skeleton h-28" aria-label="Loading summary" />
          ) : (
            <>
              {data.summary?.kind === "critical" && (
                <div role="alert" lang={lang} className="card border-[var(--bad)]">{CRIT_MSG[lang]}</div>
              )}
              {data.summary?.kind === "ok" && (
                <div lang={lang} className="card">{data.summary.text}</div>
              )}
            </>
          )}

          {data.order.status === "PROCESSING" && (
            <div className="notice notice-info">Your report is still being prepared.</div>
          )}
        </>
      )}
    </main>
  );
}

export default function Report() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
          <div className="skeleton h-8 w-40" />
          <div className="skeleton h-32" />
        </main>
      }
    >
      <ReportInner />
    </Suspense>
  );
}