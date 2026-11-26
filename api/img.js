// Trae la foto de una nota de los portales del grupo y la entrega desde este mismo sitio,
// así la placa se puede dibujar y descargar (el navegador no deja exportar imágenes de otro dominio).
import { GRUPO_HOST } from "../lib/radar.js";
const CDN_OK = /(^|\.)(radio10\.com\.ar|minutouno\.com|c5n\.com|ambito\.com)$/i;
export default async function handler(req, res) {
  let u;
  try { u = new URL(String((req.query && req.query.u) || new URL(req.url, "http://x").searchParams.get("u") || "")); } catch { return res.status(400).end(); }
  if (u.protocol !== "https:" || !(GRUPO_HOST.test(u.hostname) || CDN_OK.test(u.hostname) || (process.env.R10_IMG_HOSTS || "").split(",").filter(Boolean).some(h => u.hostname === h || u.hostname.endsWith("." + h))))
    return res.status(403).end();
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(9000), headers: { "user-agent": "Mozilla/5.0 (R10 One Touch)" } });
    const type = r.headers.get("content-type") || "";
    if (!r.ok || !type.startsWith("image/")) return res.status(502).end();
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > 12e6) return res.status(413).end();
    res.setHeader("Content-Type", type);
    res.setHeader("Cache-Control", "public, s-maxage=86400, max-age=3600");
    return res.status(200).send(buf);
  } catch { return res.status(502).end(); }
}
