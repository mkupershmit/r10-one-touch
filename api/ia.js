// Titulares, bajadas y frase con IA para la nota que eligió el redactor.
// Solo acepta el pedido de la propia página (guía editorial de R10 + la nota), para que la clave no sirva para otra cosa.
import Anthropic from "@anthropic-ai/sdk";
import { GUIA } from "../lib/guia.js";

const MODEL = process.env.R10_MODEL || "claude-opus-5-5";
const client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") return res.status(200).json({ ok: !!client });
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  if (!client) return res.status(503).json({ code: "not_configured" });
  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const prompt = String(body.prompt || "");
  if (!prompt.startsWith(GUIA) || prompt.length > GUIA.length + 9000) return res.status(400).json({ code: "bad_request" });
  try {
    const r = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: prompt }],
    });
    if (r.stop_reason === "refusal") return res.status(422).json({ code: "refused" });
    const text = r.content.filter(b => b.type === "text").map(b => b.text).join("");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return res.status(502).json({ code: "empty" });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ code: "rate_limited" });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ code: "upstream_error" });
    return res.status(500).json({ code: "error" });
  }
}
