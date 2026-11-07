"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

export default function LinkPage() {
  const { token } = useParams<{ token: string }>();
  const [step, setStep] = useState<"start" | "code" | "dead">("start");
  const [sentTo, setSentTo] = useState("");
  const [hint, setHint] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: object) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/links/${token}/${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 410) { setStep("dead"); return null; }
      if (!r.ok) {
        const m: Record<string, string> = { invalid: "Wrong code", expired: "Code expired. Ask for a new one.", locked: "Too many tries. Ask for a new code." };
        throw new Error(m[j.error] || "Something went wrong");
      }
      return j;
    } catch (e) { setErr((e as Error).message); return null; }
    finally { setBusy(false); }
  }

  async function send() {
    const j = await call("request-otp");
    if (j) { setSentTo(j.sentTo); setHint(j.devCode ? `Demo code: ${j.devCode}` : ""); setStep("code"); }
  }
  async function verify() {
    const j = await call("verify", { code });
    if (j) window.location.href = `/orders/${j.orderId}`;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold">Your report is ready</h1>
        {step === "start" && (<>
          <p className="text-[var(--muted)]">For your privacy, we will send a code to the mobile number registered with the lab.</p>
          <button className="btn" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send me a code"}</button>
        </>)}
        {step === "code" && (<>
          <p className="text-[var(--muted)]">Enter the 6-digit code sent to {sentTo}</p>
          {hint && <p className="text-sm text-[var(--warn)]">{hint}</p>}
          <input className="input tracking-widest" inputMode="numeric" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="______" />
          <button className="btn" disabled={busy || code.length !== 6} onClick={verify}>{busy ? "Checking…" : "Open report"}</button>
        </>)}
        {step === "dead" && (
          <p role="alert" className="text-[var(--bad)]">This link has expired or is not valid. Please contact the lab to get a new link.</p>
        )}
        {err && <p role="alert" className="text-[var(--bad)]">{err}</p>}
      </div>
    </main>
  );
}
