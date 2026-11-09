import type { Flag } from "./rules";

export type AiLang = "en" | "te" | "hi";
export type AiItem = { parameter: string; value: number; unit: string; flag: Flag };

const LANG_NAME: Record<AiLang, string> = { en: "English", te: "Telugu", hi: "Hindi" };
const TIMEOUT_MS = 5000;
const MAX_CHARS = 700;

export function buildPrompt(items: AiItem[], lang: AiLang) {
  const lines = items
    .map((i) => `- ${i.parameter}: ${i.value} ${i.unit} (${i.flag === "LOW" ? "below" : "above"} normal range)`)
    .join("\n");
  const system =
    `You explain lab results to elderly patients in simple ${LANG_NAME[lang]}. ` +
    "Rules: 2 to 4 short sentences. Use only the values given. Keep parameter names exactly as written in English. " +
    "Do not diagnose, do not name diseases, do not suggest medicines or doses, do not invent numbers. " +
    "End by telling the patient to see their doctor.";
  return { system, user: `Explain these out-of-range values:\n${lines}` };
}

export function validateAiText(text: string, items: AiItem[]): boolean {
  const t = text.trim();
  if (!t || t.length > MAX_CHARS) return false;
  const lower = t.toLowerCase();
  if (!items.every((i) => lower.includes(i.parameter.toLowerCase()))) return false;
  const allowed = new Set(items.map((i) => String(i.value)));
  const nums = t.match(/\d+(?:\.\d+)?/g) ?? [];
  if (!nums.every((n) => allowed.has(n))) return false;
  return true;
}

export async function aiExplain(
  items: AiItem[],
  lang: AiLang,
  opts: { apiKey?: string; model?: string; fetchImpl?: typeof fetch } = {}
): Promise<string | null> {
  const apiKey = opts.apiKey ?? process.env.AI_API_KEY;
  if (!apiKey || items.length === 0) return null;
  const doFetch = opts.fetchImpl ?? fetch;
  const { system, user } = buildPrompt(items, lang);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await doFetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: opts.model ?? process.env.AI_MODEL ?? "claude-haiku-5-5",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text ?? "";
    return validateAiText(text, items) ? text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}