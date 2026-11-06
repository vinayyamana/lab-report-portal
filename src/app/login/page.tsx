"use client";
import { useState } from "react";

type Step = "mobile" | "otp" | "choose";

export default function Login() {
  const [step, setStep] = useState<Step>("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState("");
  const [family, setFamily] = useState<{ id: string; name: string }[]>([]);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr("");
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Something went wrong");
      return j;
    } catch (e) { setErr((e as Error).message); return null; }
    finally { setBusy(false); }
  }

  async function sendOtp() {
    const j = await post("/api/auth/request-otp", { mobile });
    if (j) { setHint(j.devCode ? `Demo code: ${j.devCode}` : ""); setStep("otp"); }
  }
  async function verify() {
    const j = await post("/api/auth/verify-otp", { mobile, code });
    if (!j) return;
    if (j.choose) { setFamily(j.choose); setStep("choose"); }
    else window.location.href = j.role === "FRONT_DESK" ? "/desk" : "/orders";
  }
  async function pick(id: string) {
    const j = await post("/api/auth/select-patient", { patientId: id });
    if (j) window.location.href = "/orders";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md space-y-5">
        <h1 className="text-2xl font-semibold">Your lab reports</h1>

        {step === "mobile" && (<>
          <label className="block text-[var(--muted)]">Mobile number</label>
          <input className="input" inputMode="numeric" maxLength={10} value={mobile}
            onChange={(e) => setMobile(e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" />
          <button className="btn" disabled={busy || mobile.length !== 10} onClick={sendOtp}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </>)}

        {step === "otp" && (<>
          <p className="text-[var(--muted)]">Enter the 6-digit code sent to {mobile}</p>
          {hint && <p className="text-sm text-[var(--warn)]">{hint}</p>}
          <input className="input tracking-widest" inputMode="numeric" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="______" />
          <button className="btn" disabled={busy || code.length !== 6} onClick={verify}>
            {busy ? "Checking…" : "Continue"}
          </button>
          <button className="text-[var(--muted)] underline" onClick={() => { setStep("mobile"); setCode(""); }}>Change number</button>
        </>)}

        {step === "choose" && (<>
          <p className="text-[var(--muted)]">Whose reports do you want to see?</p>
          {family.map((p) => (
            <button key={p.id} className="btn" disabled={busy} onClick={() => pick(p.id)}>{p.name}</button>
          ))}
        </>)}

        {err && <p role="alert" className="text-[var(--bad)]">{err}</p>}
      </div>
    </main>
  );
}
