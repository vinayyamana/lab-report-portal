"use client";
import { useEffect, useState } from "react";

type Order = { id: string; orderCode: string; status: string; signedAt: string | null; doctor: { name: string } | null };

const LABEL: Record<string, string> = {
  PROCESSING: "In progress",
  READY: "Ready",
  READY_CRITICAL: "Ready",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch("/api/orders")
      .then(async (r) => {
        if (r.status === 401) { window.location.href = "/login"; return; }
        const j = await r.json();
        setOrders(j.orders);
      })
      .catch(() => setErr("Could not load reports. Please try again."));
  }, []);

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto space-y-4">
      <h1 className="text-2xl font-semibold">Your reports</h1>
      <button className="text-[var(--muted)] underline" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}>Log out</button>
      {err && <p role="alert" className="text-[var(--bad)]">{err}</p>}
      {!orders && !err && <p className="text-[var(--muted)]">Loading…</p>}
      {orders && orders.length === 0 && <p className="text-[var(--muted)]">No reports yet.</p>}
      {orders?.map((o) => (
        <a key={o.id} href={o.status === "PROCESSING" ? undefined : `/orders/${o.id}`}
           className="card block space-y-1" aria-disabled={o.status === "PROCESSING"}>
          <div className="font-semibold">{o.orderCode}</div>
          <div className="text-[var(--muted)]">{o.doctor?.name ?? ""}</div>
          <div className={o.status === "PROCESSING" ? "text-[var(--warn)]" : "text-[var(--brand)]"}>
            {LABEL[o.status]}
          </div>
        </a>
      ))}
    </main>
  );
}

