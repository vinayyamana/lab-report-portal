"use client";
import { useCallback, useEffect, useState } from "react";

type Tab = "orders" | "tasks" | "import" | "log";
type O = { id: string; orderCode: string; patient: string; mobile: string; status: string; delivery: string };
type T = { id: string; reason: string; orderCode: string; patient: string; mobile: string };
type L = { id: string; actor: string; action: string; orderId: string | null; at: string };

const DCOLOR: Record<string, string> = {
  "Not sent": "var(--muted)", Sent: "var(--brand)", Opened: "var(--brand)", Expired: "var(--warn)",
};

export default function Desk() {
  const [tab, setTab] = useState<Tab>("orders");
  const [q, setQ] = useState("");
  const [orders, setOrders] = useState<O[] | null>(null);
  const [tasks, setTasks] = useState<T[] | null>(null);
  const [log, setLog] = useState<L[] | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [imp, setImp] = useState<{ imported: number; links: number; errors: { line: number; message: string }[] } | null>(null);

  const load = useCallback(async (view: string, query = "") => {
    setErr("");
    try {
      const r = await fetch(`/api/desk?view=${view}&q=${encodeURIComponent(query)}`);
      if (r.status === 403 || r.status === 401) { window.location.href = "/login"; return; }
      const j = await r.json();
      if (view === "orders") setOrders(j.orders);
      if (view === "tasks") setTasks(j.tasks);
      if (view === "log") setLog(j.log);
    } catch { setErr("Could not load. Please try again."); }
  }, []);

  useEffect(() => { if (tab !== "import") load(tab, tab === "orders" ? q : ""); }, [tab]); // eslint-disable-line

  async function act(body: object, key: string, okMsg: string) {
    setBusy(key); setMsg(""); setErr("");
    try {
      const r = await fetch("/api/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Failed");
      setMsg(okMsg);
      load(tab, tab === "orders" ? q : "");
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(""); }
  }

  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy("import"); setErr(""); setImp(null);
    try {
      const r = await fetch("/api/import", { method: "POST", body: await f.text() });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Import failed");
      setImp(j);
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(""); }
  }

  const tabs: [Tab, string][] = [["orders", "Reports"], ["tasks", "Callbacks"], ["import", "Import"], ["log", "Access log"]];

  return (
    <main className="min-h-screen p-4 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Front desk</h1>
      <div className="flex gap-2 flex-wrap">
        {tabs.map(([k, n]) => (
          <button key={k} onClick={() => { setTab(k); setMsg(""); }}
            className={`rounded-xl border px-4 py-2 ${tab === k ? "bg-[var(--brand)] text-white" : "bg-white"}`}>{n}</button>
        ))}
      </div>
      {msg && <p role="status" className="text-[var(--brand)]">{msg}</p>}
      {err && <p role="alert" className="text-[var(--bad)]">{err}</p>}

      {tab === "orders" && (<>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); load("orders", q); }}>
          <input className="input" placeholder="Search name, mobile or order no." value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" style={{ width: 140 }}>Search</button>
        </form>
        {!orders && <p className="text-[var(--muted)]">Loading…</p>}
        {orders?.length === 0 && <p className="text-[var(--muted)]">No matching reports.</p>}
        {orders?.map((o) => (
          <div key={o.id} className="card flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">{o.orderCode} · {o.patient}</div>
              <div className="text-[var(--muted)]">{o.mobile} · {o.status === "PROCESSING" ? "In progress" : "Signed"}</div>
              <div style={{ color: DCOLOR[o.delivery] }}>{o.delivery}</div>
            </div>
            <button className="rounded-xl border px-4 py-2 bg-white disabled:opacity-50"
              disabled={o.status === "PROCESSING" || busy === o.id}
              onClick={() => act({ action: "resend", orderId: o.id }, o.id, "New link sent. The old link no longer works.")}>
              {busy === o.id ? "Sending…" : "Resend link"}
            </button>
          </div>
        ))}
      </>)}

      {tab === "tasks" && (<>
        {!tasks && <p className="text-[var(--muted)]">Loading…</p>}
        {tasks?.length === 0 && <p className="text-[var(--muted)]">No callbacks pending.</p>}
        {tasks?.map((t) => (
          <div key={t.id} className="card flex items-center justify-between gap-3 flex-wrap" style={{ borderColor: "var(--bad)" }}>
            <div>
              <div className="font-semibold">{t.patient} · {t.orderCode}</div>
              <div className="text-[var(--bad)]">{t.reason}</div>
              <div className="text-[var(--muted)]">Call: {t.mobile}</div>
            </div>
            <button className="rounded-xl border px-4 py-2 bg-white" disabled={busy === t.id}
              onClick={() => act({ action: "done", id: t.id }, t.id, "Marked as called.")}>Mark done</button>
          </div>
        ))}
      </>)}

      {tab === "import" && (
        <div className="card space-y-3">
          <p className="text-[var(--muted)]">Upload the LIS export (.csv). Signed reports get a link automatically.</p>
          <input type="file" accept=".csv,text/csv" disabled={busy === "import"} onChange={(e) => upload(e.target.files?.[0])} />
          {busy === "import" && <p className="text-[var(--muted)]">Importing…</p>}
          {imp && (
            <div>
              <p>Imported: <b>{imp.imported}</b> · Links sent: <b>{imp.links}</b> · Errors: <b>{imp.errors.length}</b></p>
              {imp.errors.map((e) => <p key={e.line} className="text-[var(--bad)] text-sm">Line {e.line}: {e.message}</p>)}
            </div>
          )}
        </div>
      )}

      {tab === "log" && (<>
        {!log && <p className="text-[var(--muted)]">Loading…</p>}
        {log?.length === 0 && <p className="text-[var(--muted)]">No activity yet.</p>}
        {log?.map((l) => (
          <div key={l.id} className="card py-3 text-sm flex justify-between gap-3 flex-wrap">
            <span className="font-semibold">{l.action}</span>
            <span className="text-[var(--muted)]">user …{l.actor.slice(-6)}</span>
            <span className="text-[var(--muted)]">{new Date(l.at).toLocaleString()}</span>
          </div>
        ))}
      </>)}
    </main>
  );
}
